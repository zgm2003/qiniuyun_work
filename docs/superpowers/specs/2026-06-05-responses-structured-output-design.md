# P2 Responses API 与结构化输出设计

## 需求判断

【需求判断】
是真问题。P1 已经把生产 AI 配置收归服务端，但真实模型当前仍直接输出 YAML。YAML 对作者友好，但对模型来说不是最稳的机器协议：字段遗漏、枚举乱写、`summary` 输出成字符串这类问题仍只能靠后置校验拦截。

【核心问题】
把“模型输出协议”从自由 YAML 改成严格 JSON 对象，再由程序转换为 YAML。用户仍看到和导出 YAML；模型不再直接负责 YAML 排版。

【复杂度检查】
本阶段只迁移生成路径，不接 MySQL、Redis、登录、RBAC、管理端，也不拆数据库表。不要把 Responses API、持久化、异步任务混成一个 PR。

【破坏性分析】
不能破坏题目三主线：3 章以上小说输入 → 结构化剧本 → YAML 编辑/校验/导出。已有 YAML Schema 字段语义不变，旧样例和 mock 转换器仍可用于测试、CI 和离线演示。

## 官方 API 依据

OpenAI 官方迁移文档说明：Responses API 是 Chat Completions 的演进接口，Chat Completions 仍支持，但新项目推荐 Responses。迁移的核心变化是：请求从 `/v1/chat/completions` 改为 `/v1/responses`，输入从 `messages` 映射为 `input`/`instructions`，输出从 `choices[0].message.content` 改为 Responses 的 typed `output` 或 SDK 的 `output_text`。

Structured Outputs 官方文档说明：结构化输出通过 JSON Schema 约束模型响应；在 Responses API 中使用 `text.format`，形状为：

```json
{
  "text": {
    "format": {
      "type": "json_schema",
      "name": "script_document",
      "strict": true,
      "schema": {}
    }
  }
}
```

官方文档还强调：如果只是约束模型最终回答的结构，应使用结构化 `text.format`，而不是 function calling。我们的场景正是“让模型返回剧本文档”，不是让模型调用工具。

## 目标架构

当前 P1：

```text
小说文本
↓
Chat Completions
↓
模型直接输出 YAML
↓
validateScriptYaml
↓
前端编辑/导出 YAML
```

P2 目标：

```text
小说文本
↓
Responses API + text.format JSON Schema
↓
模型输出严格 JSON 剧本文档
↓
Zod 校验 ScriptDocument
↓
程序 stringify 为 YAML
↓
validateScriptYaml 二次校验
↓
前端编辑/导出 YAML
```

关键原则：

1. 模型输出 JSON，不直接输出 YAML。
2. YAML 仍是用户最终看到、编辑、导出的格式。
3. JSON Schema 与 Zod Schema 必须来自同一份业务结构，不能手写两套互相漂移的字段定义。
4. `validateScriptYaml` 继续作为最终出口校验，不能因为 Structured Outputs 就删掉。
5. `store:false` 继续保留，避免默认存储请求内容。

## 数据结构

### ScriptDocument

继续沿用当前 `src/lib/script-schema.ts` 中的业务结构：

```text
metadata
characters
scenes
summary
```

P2 不改变字段语义，不新增必填字段，不改 `format_version`。如果需要为了 JSON Schema 增加内部类型，只能映射到同一份 `ScriptDocument`，不能创造第二套“AI 专用剧本结构”。

### JSON Schema

需要新增一个导出的 JSON Schema 常量，例如：

```ts
export const SCRIPT_DOCUMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["metadata", "characters", "scenes", "summary"],
  properties: {
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["title", "source_chapters", "language", "format_version"],
      properties: {
        title: { type: "string", minLength: 1 },
        source_chapters: { type: "integer", minimum: 3 },
        language: { type: "string", minLength: 1 },
        format_version: { type: "string", const: "1.0" }
      }
    }
  }
} as const;
```

实施计划中会补完整 schema。这里的设计重点是：JSON Schema 是给 Responses API 的输入约束；Zod 是运行时最终判定；YAML 是用户界面协议。

## Provider 设计

当前 provider 名称是 `openai-compatible`。P2 不建议立刻新增用户可选 provider。更简单的做法：

- 仍使用 `provider: "openai-compatible"` 作为产品 provider。
- 在服务端 env 增加生成模式：
  - `OPENAI_COMPATIBLE_GENERATION_API=responses`
  - 可选值：`chat-completions`、`responses`
  - 生产默认建议为 `responses`。
  - 开发可切回 `chat-completions` 做兼容排查。

这样避免 UI 多一个 provider 分支，也不会让用户关心 API 形态。API 形态是服务端实现细节。

## 请求格式

Responses 请求使用服务端配置：

```json
{
  "model": "gpt-5.5",
  "store": false,
  "instructions": "你是小说改编剧本助手。只返回符合 JSON Schema 的剧本文档。",
  "input": "标题、章节数、小说正文和改编要求",
  "text": {
    "format": {
      "type": "json_schema",
      "name": "script_document",
      "strict": true,
      "schema": {}
    }
  }
}
```

`input` 可以是字符串，不需要引入多轮 state、tools、previous_response_id 或 Conversations API。这个转换任务是单轮生成，状态留给后续持久化 PR。

## 响应解析

不要假设永远有 `output_text`。REST 返回中需要能处理 typed `output`：

```text
response.output[]
  type === "message"
    content[]
      type === "output_text" → text
      type === "refusal" → refusal
```

解析规则：

1. 如果有 refusal，抛出清晰错误：`AI 拒绝生成剧本：...`。
2. 如果没有可解析文本，抛出：`AI 服务没有返回结构化剧本内容`。
3. 如果文本不是 JSON，抛出：`AI 服务返回了无法解析的 JSON`。
4. JSON 解析后用 Zod 校验为 `ScriptDocument`。
5. 校验通过后用 `yaml.stringify(document)` 生成 YAML。
6. 再跑 `validateScriptYaml(yaml)`，作为出口保护。

不要用空字符串、空数组或默认角色兜底。字段缺失就是模型/Schema/解析错误，必须报错。

## 错误处理

错误要分清楚：

- `OPENAI_COMPATIBLE_API_KEY 未配置`
- `AI 服务请求失败：<status>`
- `AI 服务返回了 HTML 页面，不是 JSON`
- `AI 拒绝生成剧本：<refusal>`
- `AI 服务没有返回结构化剧本内容`
- `AI 服务返回了无法解析的 JSON`
- `AI 返回的剧本文档未通过 Schema 校验：<path/message>`
- `程序生成的 YAML 未通过 Schema 校验：<path/message>`

## 测试策略

必须先测纯函数，再接 provider：

1. JSON Schema 常量包含所有必填字段和 `additionalProperties:false`。
2. Responses 请求打到 `/responses`，body 包含 `store:false` 和 `text.format.type=json_schema`。
3. Responses 返回 output_text JSON 时，程序转换为 YAML 并通过现有校验。
4. Responses 返回 refusal 时，抛出清晰错误。
5. Responses 返回坏 JSON 时，抛出 JSON 解析错误。
6. Responses 返回结构缺字段时，抛出 Schema 校验错误。
7. `chat-completions` 旧路径仍可在开发配置下通过，避免一次性切断回退路径。

## 不做什么

P2 不做：

- 不接 MySQL。
- 不接 Redis。
- 不做登录/Auth/RBAC。
- 不做管理端供应商配置。
- 不做 streaming。
- 不做 function calling。
- 不做 Conversations API。
- 不拆 `characters/scenes/dialogue` 数据库表。
- 不改变 YAML Schema 现有字段语义。

## 成功标准

1. 生产默认使用 Responses API + Structured Outputs。
2. 用户最终仍看到 YAML。
3. `npm test`、`npm run lint`、`npm run build` 通过。
4. P1 的生产安全边界仍成立：浏览器不能覆盖 API Key/Base URL/model。
5. mock provider 仍只用于测试、CI 和离线样例。
6. 文档明确：P2 是生成稳定性升级，不是数据库或权限系统升级。
