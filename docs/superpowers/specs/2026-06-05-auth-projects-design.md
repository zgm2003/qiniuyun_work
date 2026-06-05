# P4 登录、用户隔离与服务端项目列表设计

## 需求判断

【需求判断】
是真问题。题目三主线已经能完成“3 章以上小说文本 → AI 生成结构化 YAML 剧本 → Schema 校验 → 编辑导出”，但作者作品资产现在主要靠浏览器 localStorage 和基础 MySQL API。上线后，作者需要登录后看到自己的小说改编项目，并能跨设备恢复小说原文、最新 YAML 剧本和生成报告。

【核心问题】
P4 不是完整用户中心。P4 只解决作品归属：谁创建项目，谁能看到项目，谁能继续编辑项目。登录、会话、项目列表都是为了保护和恢复题目三的核心资产。

【复杂度检查】
本阶段只做邮箱密码、HttpOnly Cookie Session、项目 owner 绑定、项目列表、项目详情加载、当前工作区保存到服务端。不要把 Prompt 模板化、AI Key 入库、RBAC 管理端、Redis 异步队列混进同一个 PR。

【破坏性分析】
不能破坏现有比赛演示闭环。未登录用户仍然可以打开 `/workspace`，导入小说，生成 YAML，编辑校验，导出文件，使用 localStorage 草稿。登录只增强“服务端保存和项目列表”，不拦住题目三演示流程。

## 主线边界

题目三主线永远是：

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

P4 新增能力必须服务于这条线：

```text
作者登录
↓
保存当前小说改编项目
↓
在项目列表中只看到自己的项目
↓
打开项目恢复小说正文和最新 YAML
↓
继续走原来的 YAML 编辑、校验、导出流程
```

## 方案选择

### 推荐方案：邮箱密码 + MySQL Session + owner_user_id

使用 MySQL 存 `users`、`sessions`，给 `projects` 增加可空 `owner_user_id`。新 UI 的服务端项目保存会绑定当前登录用户；项目列表和项目详情必须按当前用户过滤。

优点：

- 依赖少，不引入外部 Auth SaaS。
- Session 放 HttpOnly Cookie，避免 JWT 存 localStorage。
- 和现有 MySQL 基础持久化直接衔接。
- `owner_user_id` 可空，兼容 P3 已创建或测试里的匿名项目数据。

缺点：

- 需要自己维护密码哈希、Session 过期、Cookie 设置。

### 不选方案：现在接 OAuth

OAuth 不解决当前真实问题。它会引入第三方回调、账号合并、部署域名、密钥配置和调试复杂度。第一版作者登录只需要邮箱和密码。

### 不选方案：现在做完整 RBAC/管理端

P4 只需要普通作者拥有自己的项目。`admin/member`、管理端入口、平台配置权限是后续阶段。现在做权限矩阵会把主线拖偏。

### 不选方案：强制登录后才能转换

这会破坏现有演示和录屏流程。未登录转换、编辑、导出、localStorage 草稿必须继续可用。

## 数据结构

### users

```sql
CREATE TABLE users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

规则：

- `email` 统一 trim + lowercase 后入库。
- `password_hash` 使用 Node `crypto.scrypt` 派生，不保存明文密码。
- `status='disabled'` 的用户不能登录。

### sessions

```sql
CREATE TABLE sessions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_sessions_token_hash (token_hash),
  KEY idx_sessions_user_expires (user_id, expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

规则：

- Cookie 里放随机 session token。
- 数据库只保存 `sha256(token)`，不保存原始 token。
- Cookie 必须是 `HttpOnly`、`SameSite=Lax`；生产环境加 `Secure`。
- 过期 Session 不可用，登出时删除当前 Session。

### projects 增加 owner

```sql
ALTER TABLE projects
  ADD COLUMN owner_user_id VARCHAR(36) NULL AFTER id,
  ADD KEY idx_projects_owner_updated (owner_user_id, updated_at),
  ADD CONSTRAINT fk_projects_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
```

规则：

- 新的登录用户保存项目时必须写 `owner_user_id`。
- 老数据或兼容 API 可以保持 `owner_user_id IS NULL`。
- 项目列表只查 `owner_user_id = current_user.id`，绝不返回无主项目或其他用户项目。

## 密码和 Session 设计

密码哈希格式：

```text
scrypt:v1:<salt_base64url>:<derived_key_base64url>
```

参数固定在代码里，第一版不做多算法协商：

```text
keyLength = 64
saltBytes = 16
```

Session token：

```text
randomBytes(32).toString('base64url')
```

Session 生命周期：

```text
30 天
```

不要把用户身份或权限声明塞进可被前端读写的 localStorage。

## API 合约

### Auth API

```text
POST /api/auth/register
body: { email, password, name? }
return: { user }
side effect: set session cookie
```

```text
POST /api/auth/login
body: { email, password }
return: { user }
side effect: set session cookie
```

```text
POST /api/auth/logout
side effect: delete current session and clear cookie
return: { ok: true }
```

```text
GET /api/auth/me
return: { user: UserSummary | null }
```

`UserSummary` 只能包含：

```ts
type UserSummary = {
  id: string;
  email: string;
  name: string;
};
```

不能返回 `password_hash`、session token 或任何敏感字段。

### Project API

新增：

```text
GET /api/projects
```

要求登录。返回当前用户项目列表，按 `updated_at DESC` 排序。

```text
GET /api/projects/[projectId]
```

要求登录且项目属于当前用户。返回项目正文、状态和最新剧本版本。

```text
PATCH /api/projects/[projectId]
```

要求登录且项目属于当前用户。只更新标题和小说正文，不改 YAML 版本。

保留并增强：

```text
POST /api/projects
```

有 Session 时创建归属当前用户的项目；无 Session 时保持 P3 兼容行为，可以创建 `owner_user_id = NULL` 的匿名项目。但 UI 的服务端项目保存入口只对登录用户开放。

```text
POST /api/projects/[projectId]/versions
POST /api/projects/[projectId]/generation-runs
```

如果项目有 `owner_user_id`，必须要求当前用户匹配；如果是旧匿名项目，保持 P3 兼容行为。任何带 owner 的项目都不能被其他用户写入。

## 前端流程

### 未登录

```text
/workspace 可用
/script 可用
/drafts localStorage 可用
/report 可用
导出 YAML 可用
服务端项目列表显示登录提示
```

### 已登录

```text
/workspace 显示当前用户和“保存到服务端”入口
/projects 显示当前用户服务端项目列表
点击项目后加载 title/sourceText/latest YAML/report 到 WorkspaceContext
/script 继续编辑 YAML
/drafts 仍保留本地草稿
```

## 组件边界

新增文件按责任拆分：

```text
src/lib/auth/password.ts        密码哈希和校验
src/lib/auth/session.ts         session token、cookie 名、cookie option
src/lib/server/auth.ts          用户注册、登录、当前用户、登出服务
src/lib/server/projects.ts      增加 owner 过滤、列表、详情、更新
src/app/api/auth/*              auth route handlers
src/app/api/projects/*          项目列表、详情、更新、保存 route handlers
src/features/auth/*             登录/注册表单和当前用户客户端
src/features/workspace/projects-page.tsx  服务端项目列表页面
```

不要把 SQL 写进 React 组件。不要把密码逻辑写进 API route。API route 只做请求解析、调用服务、返回 JSON。

## 错误处理

- 登录失败统一返回 `邮箱或密码错误`，不要暴露邮箱是否存在。
- disabled 用户登录返回 `账号不可用`。
- 未登录访问项目列表返回 401。
- 访问别人的项目返回 404，不返回 403，避免泄漏项目是否存在。
- YAML 版本保存仍然必须先通过现有 Schema 校验。
- 数据库保存失败不能清空当前编辑器内容。

## 测试要求

必须覆盖：

1. 邮箱 normalization。
2. 密码 hash 不等于明文，正确密码通过，错误密码失败。
3. Session 数据库只存 token hash。
4. 过期 Session 不能获取用户。
5. `GET /api/auth/me` 不返回敏感字段。
6. 用户只能列出自己的项目。
7. 用户不能加载、更新、写入别人的项目。
8. 未登录仍可执行原 `/api/convert` 流程。
9. localStorage 草稿测试继续通过。
10. `npm test`、`npm run lint`、`npm run build` 通过。

## P5/P6 日程锁定

P4 完成后，下一阶段不要直接做 Redis。

### P5：Prompt 模板化

目标：把当前写在 `src/lib/ai-provider.ts` 里的 prompt 迁移成可测试、可版本化的模板模块。

第一版只支持固定变量：

```text
{{title}}
{{chapter_count}}
{{chapters}}
{{schema_summary}}
```

不做任意 JS、复杂表达式、插件系统。Prompt 模板是配置，不是代码执行环境。无论模板怎么变，输出仍必须通过 `ScriptDocument` / YAML Schema 校验。

### P6：AI 供应商配置加密入库

目标：平台统一管理 AI Base URL、模型、Key 和健康状态。

Key 入库规则：

```text
AES-256-GCM
每条 key 独立 iv
保存 ciphertext / iv / auth_tag / key_version
主密钥只放服务端 env
前端只显示 masked key 状态
```

P6 仍要保留 env fallback：数据库配置不可用时，现有 `OPENAI_COMPATIBLE_*` 服务端环境变量还能继续支撑生产转换。

## 结论

P4 值得做，但它不是新主线。它只是给题目三的小说、YAML 剧本和生成记录加上作者归属。当前 PR 只做登录、用户隔离和服务端项目列表；Prompt 模板化和 AI Key 加密入库已经排入 P5/P6，不混进 P4。
