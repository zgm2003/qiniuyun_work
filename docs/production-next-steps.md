# 上线版后续路线

本文档用于在上下文切换后继续推进项目。当前项目已经完成题目三的比赛交付闭环，并且已经接入 OpenAI-compatible 真实 AI 调用雏形；下一阶段目标是把它从演示工具推进到可上线产品。

## 当前状态

已经完成：

- 小说 `.txt` / `.md` 导入。
- 3 章以上输入校验。
- 章节识别与章节大纲预览。
- OpenAI-compatible 真实模型调用。
- 开发/本地调试模型列表获取接口。
- YAML 剧本生成。
- YAML Schema 校验。
- 剧本质量清单。
- YAML 编辑和导出。
- localStorage 本地草稿。
- 题目验收清单和 Schema 说明文档。

当前不是假 AI demo。生产 AI 配置已加固为服务端持有，真实生成默认走 Responses API + Structured Outputs；开发/本地调试仍保留请求级配置入口：

```text
生产：服务端 env 配置 Base URL / Model / API Key
↓
请求 /api/convert
↓
服务端调用 OpenAI-compatible Responses API
↓
返回严格 JSON 剧本文档
↓
服务端转换为 YAML
```

开发：页面可临时填写 Base URL / Model / API Key，便于比赛演示和本地调试；生产请求不会接受这些浏览器覆盖。

## 总原则

1. 真实 AI 是产品能力，不把 `mock` 暴露为生产能力。
2. YAML Schema 是核心协议，不能破坏已有 YAML 字段语义。
3. 上线后 API Key 由服务端保存，普通用户不填写、不查看真实 Key。
4. MySQL/Redis 属于后续 PR，本 P1 不接入。
5. 先保存完整 YAML 版本，不急着拆 `scene`、`dialogue`、`character` 多张表。
6. 每个 PR 只做一件事，合并后 `npm test`、`npm run lint`、`npm run build` 必须通过。

## 推荐推进顺序

### P0：比赛交付冻结

目标：保证题目三交付线稳定。

状态：基本完成。

已完成证据：

- `README.md`
- `docs/requirement-checklist.md`
- `docs/script-yaml-schema.md`
- `docs/final-demo-guide.md`
- `samples/novel-3chapters.txt`
- `samples/output.yaml`

验收：

```bash
npm test
npm run lint
npm run build
```

### P1：真实 AI 生产化配置

目标：上线时使用服务端真实 AI 配置，而不是普通用户每次填写 API Key。

必须做：

- 把默认模型从旧默认值升级到当前生产目标模型。
- 生产环境隐藏或禁用页面 API Key 输入。
- `/api/convert` 在生产环境只使用服务端环境变量；未来可迁移到服务端数据库配置。
- 生产环境禁止请求级 `provider: "mock"`。
- 保留测试层 `mock`，但只用于单元测试、CI 和离线样例。
- 增加清晰错误分类：Key 未配置、模型请求失败、结构校验失败、响应格式错误。

建议文件：

- `src/lib/ai-provider.ts`
- `src/app/api/convert/route.ts`
- `src/features/workspace/workspace-context.tsx`
- `src/features/workspace/workspace-page.tsx`
- `.env.example`
- `README.md`
- `src/lib/ai-provider.test.ts`
- `src/app/api/convert/route.test.ts`

注意：

- 不要把 API Key 写入仓库。
- 不要把真实 API Key 返回给前端。
- 不要删除测试用 `mock` 转换器。
- P1 已完成生产配置加固；P2 已迁移到 Responses API + Structured Outputs。开发排查仍可临时回退 Chat Completions。

### P2：Responses API 与结构化输出

目标：提高真实模型输出稳定性。

状态：已实施。生产默认使用 `OPENAI_COMPATIBLE_GENERATION_API=responses`，开发排查可临时设为 `chat-completions`。

设计文档：`docs/superpowers/specs/2026-06-05-responses-structured-output-design.md`

实施计划：`docs/superpowers/plans/2026-06-05-responses-structured-output.md`

P2 后不再让生产模型直接输出 YAML。上线版生成方式是：

```text
小说文本
↓
Responses API + JSON Schema
↓
严格 JSON 剧本文档
↓
Zod 校验
↓
程序 stringify 为 YAML
↓
前端编辑和导出 YAML
```

已完成：

- 新增 Responses API 生成路径。
- 用 JSON Schema 约束 AI 输出结构。
- 保留 YAML 作为用户最终看到和导出的格式。
- 继续用 `validateScriptYaml` 校验防止坏结构流出。
- 测试 AI 返回 JSON、程序转 YAML、坏结构拒绝。

建议文件：

- `src/lib/ai-provider.ts`
- `src/lib/script-schema.ts`
- `src/lib/openai-compatible.ts`
- `src/lib/ai-provider.test.ts`
- `samples/output.yaml`
- `docs/script-yaml-schema.md`

### P3：MySQL 基础持久化

目标：保存项目、剧本版本和生成记录。

第一版只建最小表：

```text
projects
- id
- title
- source_text
- status
- created_at
- updated_at

script_versions
- id
- project_id
- yaml
- report_json
- validation_json
- created_at

generation_runs
- id
- project_id
- provider
- model
- status
- error_message
- created_at
```

必须做：

- 新增数据库连接模块。
- 新增迁移脚本或初始化 SQL。
- 新增保存项目 API。
- 新增保存剧本版本 API。
- localStorage 草稿先保留，不立即替换。
- 数据库保存失败不能影响当前 YAML 编辑器里的内容。

建议文件：

- `src/lib/db/*`
- `src/lib/server/projects.ts`
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[projectId]/versions/route.ts`
- `docs/product-architecture.md`
- `.env.example`

注意：

- 不要用其他项目的 root DSN 作为生产配置。
- 单独创建本项目数据库和最小权限用户。

### P4：登录与会话

目标：用户可以拥有自己的项目。

推荐第一版：

```text
邮箱 + 密码
HttpOnly Cookie Session
MySQL session 或短期 session 存储
```

不要做：

```text
JWT 存 localStorage
复杂 OAuth
复杂权限矩阵
```

必须做：

- 用户注册或管理员创建用户。
- 登录。
- 登出。
- 当前用户接口。
- 项目按用户隔离。

建议文件：

- `src/lib/auth/*`
- `src/app/(auth)/*`
- `src/app/api/auth/*`
- `src/lib/server/projects.ts`

### P5：简单 RBAC 和管理端骨架

目标：区分管理员和普通用户。

第一版只需要：

```text
admin
member
```

规则：

- `admin` 能进入管理端。
- `member` 只能管理自己的项目。
- 所有权限判断必须在服务端执行。
- 前端隐藏按钮只是 UX，不是授权。

建议文件：

- `src/lib/auth/rbac.ts`
- `src/app/(admin)/*`
- `src/features/admin/*`

### P6：AI 供应商配置入库

目标：平台统一管理 AI Key、Base URL、模型和健康状态。

建议表：

```text
ai_providers
- id
- name
- driver
- base_url
- api_key_ciphertext
- status
- health_status
- created_at
- updated_at

ai_provider_models
- id
- provider_id
- model_id
- display_name
- enabled
```

必须做：

- API Key 加密后入库。
- 前端只显示 masked key 状态。
- 管理端可以刷新模型列表。
- 工作台只使用已启用 provider 和 model。

### P7：Redis 与异步任务

目标：支持长小说转换、任务状态和限流。

只有出现这些需求时再引入 Redis：

- 长小说转换超过 HTTP 可接受等待时间。
- 需要任务进度。
- 需要接口限流。
- 需要短期模型健康状态缓存。
- 需要 session 缓存或 token 黑名单。

Redis 不存：

- 小说正文长期资产。
- YAML 剧本长期资产。
- 用户项目主体数据。

## 下个 AI 窗口接力提示

如果切换到新的 AI 窗口，先让它读取：

```text
AGENTS.md
README.md
docs/requirement-checklist.md
docs/production-next-steps.md
docs/product-architecture.md
docs/script-yaml-schema.md
src/lib/ai-provider.ts
src/app/api/convert/route.ts
src/features/workspace/workspace-context.tsx
```

然后让它先回答三个问题：

```text
1. 当前 AI 调用是怎么走的？
2. 生产环境为什么不能让用户填写 API Key？
3. P2 完成后下一步应该做什么，为什么？
```

正确答案应该是：下一步做 P3 MySQL 基础持久化；Redis/Auth/RBAC 继续后置。

## 当前不要做

- 不要马上接 Redis。
- 不要马上做完整 RBAC。
- 不要把 scene、dialogue、character 全拆表。
- 不要删除 `mock` 测试转换器。
- 不要把生产 API Key 写到代码或文档。
- 不要破坏题目三的 YAML 交付主线。
