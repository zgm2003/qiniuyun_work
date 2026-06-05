# P5 Prompt 模板化设计

## 需求判断

【需求判断】
是真问题。当前真实 AI 转换链路已经能走 Chat Completions 或 Responses API，但核心 Prompt 仍写在 `src/lib/ai-provider.ts` 里。这样会带来三个直接问题：Prompt 无法单独测试、无法版本化记录、后续接管理端或数据库配置时没有稳定边界。

【核心问题】
P5 不是做 Prompt 市场，也不是做复杂编排。P5 只解决一件事：把“小说转剧本”的生成指令从 provider 调用代码里拆出来，形成可测试、可版本化、只能固定变量替换的模板模块，并保持现有 `ScriptDocument` / YAML Schema 输出协议不变。

【复杂度检查】
本阶段只支持两个模板用途：

- `script_generation_chat_yaml`：Chat Completions 路径使用，模型直接返回 YAML。
- `script_generation_responses_json`：Responses 路径使用，模型返回严格 JSON，再由程序转 YAML。

不做任意 JS、条件表达式、循环语法、插件、Prompt 市场、多租户继承、在线编辑 UI、RBAC。模板可以入库，但必须有代码内置默认模板作为 fallback，不能让数据库缺数据导致题目三主线不可用。

【破坏性分析】
不能改变题目三主线：3 章以上小说文本 → AI 生成结构化剧本 → YAML 编辑/校验/导出。不能改变现有 YAML 字段语义、`ScriptDocument` Schema、mock provider、`/api/convert` 请求和响应结构。Chat Completions 和 Responses 两条路径的行为只能等价迁移，不能趁机重写输出协议。

## 主线边界

题目三主线保持不变：

```text
3 章以上小说文本
↓
AI 自动转换
↓
结构化 YAML 剧本
↓
作者可编辑、可校验、可导出
↓
YAML Schema 文档说明设计原因
```

P5 新增的是 Prompt 的工程边界：

```text
NovelConversionInput
↓
parseNovelChapters + requireMinimumChapters
↓
PromptTemplateVariables
↓
固定变量模板渲染
↓
OpenAI-compatible API
↓
ScriptDocument / YAML Schema 校验
```

模型配置、API Key、Base URL 加密入库属于 P6，不在 P5 做。

## 方案选择

### 推荐方案：版本化模板模块 + prompt_templates 表 + 默认 fallback

新增 `src/lib/prompt-templates.ts` 管理默认模板、变量构建和模板渲染。新增 `prompt_templates` 表保存模板元数据和模板正文；运行时通过 `src/lib/server/prompt-templates.ts` 读取启用模板，读不到就用默认模板。第一版不做 UI，只提供服务函数和测试。

优点：

- Prompt 从 provider 调用代码里拆出来，单测可以直接验证变量和渲染结果。
- 表结构提前稳定，P6/P7 后续可以接管理入口，不需要再改生成链路。
- 默认 fallback 保证数据库未初始化时转换仍可用，不破坏演示。
- 只允许固定变量替换，不引入模板语言复杂度。

代价：

- 比“只拆文件”多一个表和读取服务。
- 需要在测试里覆盖 DB 缺失 fallback，否则容易产生隐性生产故障。

### 不选方案：只把字符串搬到另一个文件

这只是换地方硬编码。没有版本、没有模板 key、没有入库边界，后续仍然要重做。

### 不选方案：现在做 Prompt 管理页面

管理页面会牵扯登录权限、RBAC、审计、回滚、表单校验和发布流程。P5 的真实问题是模板边界和渲染，不是管理端体验。

### 不选方案：引入 Handlebars / Liquid / JS 表达式

当前只需要 5 个固定变量。模板语言会制造新的注入面和调试复杂度。固定变量替换更好，未知变量直接报错。

## 数据结构

### prompt_templates

```sql
CREATE TABLE IF NOT EXISTS prompt_templates (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  template_key VARCHAR(100) NOT NULL,
  version VARCHAR(32) NOT NULL,
  format ENUM('yaml', 'json') NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template MEDIUMTEXT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_prompt_templates_key_version (template_key, version),
  KEY idx_prompt_templates_lookup (template_key, enabled, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

字段原则：

- `template_key` 表示用途，不表示模型供应商。
- `version` 是人工可读版本，如 `v1`。第一版不做自动 SemVer 解析。
- `format` 只允许 `yaml` 或 `json`，对应当前两条生成路径。
- `system_prompt` 和 `user_prompt_template` 分开，保持 Chat Completions / Responses 的调用边界清晰。
- `enabled=1` 的同 key 多版本时，运行时取 `updated_at DESC LIMIT 1`。

不存：

- API Key。
- Base URL。
- 模型 ID。
- 用户私有模板。
- 任意脚本或表达式。

## 模板变量

第一版只允许这些变量：

```text
{{title}}
{{chapter_count}}
{{chapters}}
{{schema_summary}}
{{quality_rules}}
```

变量含义：

- `title`：小说标题，来自 `NovelConversionInput.title`。
- `chapter_count`：`parseNovelChapters(input.text).length`，并且必须先通过最少 3 章检查。
- `chapters`：章节列表的稳定文本格式，包含章节编号、标题、正文。
- `schema_summary`：当前 `ScriptDocument` 必填结构摘要，不把完整 JSON Schema 全塞进 Prompt。
- `quality_rules`：生成质量规则，如角色 ID、scene ID、角色引用、summary 对象等。

未知变量处理：

- 模板中出现未允许变量时，渲染直接抛错。
- 变量值缺失时直接抛错。
- 不做空字符串兜底，因为这会掩盖数据流错误。

## 模块边界

### `src/lib/prompt-templates.ts`

负责纯逻辑：

- 定义 `PromptTemplateKey`、`PromptTemplateFormat`、`PromptTemplateRecord`。
- 导出默认模板 `DEFAULT_PROMPT_TEMPLATES`。
- `buildScriptPromptVariables(input)`：解析章节并构造固定变量。
- `renderPromptTemplate(template, variables)`：固定变量替换，拒绝未知变量。
- `resolveDefaultPromptTemplate(key)`：代码 fallback。

该文件不访问数据库、不读 env、不调用 fetch。

### `src/lib/server/prompt-templates.ts`

负责数据库读取：

- `getPromptTemplateByKey(templateKey, runner?)`。
- DB 读取失败或无启用模板时返回默认模板。
- 只负责读取，不做管理端写入 API。

### `src/lib/ai-provider.ts`

保留 provider 编排：

- API Key / Base URL / model / temperature 解析仍在这里。
- Chat Completions 使用 `script_generation_chat_yaml` 模板。
- Responses 使用 `script_generation_responses_json` 模板。
- 最终仍必须走 `validateScriptYaml` 或 `parseScriptDocumentJson` + `scriptDocumentToValidatedYaml`。

## API 合约

P5 不改变外部 API：

```text
POST /api/convert
body: { title, text, modelConfig? }
return: { yaml, report }
```

P5 不新增管理 API。后续 P7 做管理端时再暴露 CRUD。

## 错误处理

- 小说少于 3 章：沿用现有错误。
- 模板出现未知变量：返回转换失败错误，测试必须覆盖。
- DB 无模板：使用默认模板，不报错。
- DB 查询失败：使用默认模板。这里不是吞 bug，而是故意把数据库模板降级为可选读源，避免破坏转换主线。
- AI 返回坏 YAML / JSON：沿用现有 Schema 校验错误。

## 测试要求

必须覆盖：

1. 模板变量构建：标题、章节数、章节文本都来自真实 `parseNovelChapters`。
2. 少于 3 章时，变量构建直接失败。
3. 渲染只替换允许变量。
4. 未知变量报错，不静默保留。
5. 默认 YAML 模板包含 YAML 输出约束和 `{{schema_summary}}` / `{{quality_rules}}`。
6. 默认 JSON 模板包含 JSON 输出约束，Responses instructions 不再散落在 provider 中。
7. `ai-provider` Chat Completions 请求体使用模板渲染结果。
8. `ai-provider` Responses 请求体使用模板渲染结果。
9. `prompt_templates` schema 存在关键字段和索引。
10. server 读取无数据时 fallback 到默认模板。

## P6/P7 预留但不实施

P6 才做：AI 供应商配置加密入库。

P7 才做：Prompt 模板管理 UI、RBAC、审计、启停发布。

P5 只把边界打好，不提供用户可编辑入口。

## 结论

值得做。当前特殊情况是 Prompt 和 provider 调用混在一个文件里，导致数据结构不清。P5 的好品味改法不是加更多 if，而是把 Prompt 变成明确数据结构：模板 key、format、system prompt、user template、固定变量和默认 fallback。输出协议不变，复杂度可控，后续 P6/P7 有稳定落点。
