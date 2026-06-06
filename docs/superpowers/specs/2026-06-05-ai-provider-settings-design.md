# P6 AI 供应商配置加密入库设计

## 需求分析

【需求判断】
是真问题。现在真实 AI 调用已经可用，Prompt 也已经模板化，但 AI Base URL、模型和 API Key 仍主要来自服务端环境变量。环境变量适合兜底，不适合作为长期运营配置：不能版本化管理多个供应商，不能记录模型列表和健康状态，也不能让后续管理端安全地维护 Key。

【核心问题】
P6 只解决一件事：把平台级 AI 供应商配置变成明确的数据结构，并保证 API Key 加密后入库，运行时优先读取数据库启用配置，数据库不可用时保留现有 `OPENAI_COMPATIBLE_*` env fallback。题目三主线仍然是小说转结构化 YAML 剧本，不改变 `/api/convert` 的输入输出协议。

【复杂度检查】
本阶段只支持 `openai-compatible` driver。第一版不做多租户 Key、不做计费、不做复杂供应商策略、不做完整管理端 UI、不做账号权限系统。P6 只提供 server-only 的保存、读取、解密、模型刷新和健康检查边界，避免暴露无保护的敏感写接口。

【破坏性分析】
不能破坏：

- 作者仍可完成题目三演示闭环。
- `/api/convert` 请求和响应结构不变。
- `OPENAI_COMPATIBLE_*` env fallback 保留。
- 开发环境请求级 API Key / Base URL / model 调试能力保留。
- 生产环境仍不接受浏览器传入 API Key、Base URL 或 model 覆盖。
- YAML Schema、Prompt 模板 key、mock 测试 provider 不变。

## 主线边界

题目三主线继续保持：

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

P6 新增运行时配置边界：

```text
/api/convert
↓
生产环境忽略浏览器敏感覆盖
↓
读取数据库默认启用 AI provider + 默认启用 model
↓
解密 API Key
↓
调用 OpenAI-compatible Responses / Chat Completions
↓
ScriptDocument / YAML Schema 校验
↓
数据库异常或未配置时回退 OPENAI_COMPATIBLE_* env
```

P6 不改变 Prompt 模板体系。Prompt 继续由 P5 的 `prompt_templates` / 默认模板 fallback 负责。

## 方案选择

### 推荐方案：数据库优先 + AES-256-GCM 加密 + env fallback

新增 `ai_providers` 和 `ai_provider_models` 两张表。`ai_providers` 保存供应商名称、driver、Base URL、加密后的 API Key、默认标记和健康状态。`ai_provider_models` 保存该供应商可用模型、显示名、启用状态和默认标记。运行时优先读取默认启用 provider 和默认启用 model，解密 Key 后调用现有 OpenAI-compatible 逻辑。数据库没有可用配置、读取失败或解密配置缺失时，回退现有 env 配置。

优点：

- Key 明文不入库、不返回前端。
- “用哪个供应商 / 模型”由数据结构表达，不靠随机 if 或最新更新时间猜测。
- env fallback 保证现有部署不被 P6 打断。
- 后续平台配置入口可以直接复用 server-only 服务，不需要重写运行时调用链。

代价：

- 需要增加一个 server-only 加密模块和一组服务测试。
- 默认 provider/model 需要服务层维护唯一性，不能只靠 MySQL partial unique index。

### 不选方案：直接把 API Key 明文写入数据库

这是最糟糕的做法。数据库泄漏、日志误打、调试查询都会暴露 Key。P6 的核心就是“加密后入库”，明文入库等于没做。

### 不选方案：只继续用 env

env 是部署兜底，不是运营配置。继续只用 env 无法管理多个 provider、无法刷新模型列表、无法记录健康状态，也无法回答“AI 配置什么时候入库”。

### 不选方案：P6 同时做完整管理端

这会把 Key 加密、供应商运行时、页面、表单、导航全部混成一个大 PR。没有好品味。P6 先把数据结构和运行时边界做正确；是否需要管理入口，后面按真实运营需求再做。

## 数据结构

### `ai_providers`

```sql
CREATE TABLE IF NOT EXISTS ai_providers (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  driver ENUM('openai-compatible') NOT NULL,
  base_url VARCHAR(512) NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  api_key_iv CHAR(24) NOT NULL,
  api_key_auth_tag CHAR(24) NOT NULL,
  api_key_version INT NOT NULL DEFAULT 1,
  status ENUM('enabled', 'disabled') NOT NULL DEFAULT 'enabled',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  health_status ENUM('unknown', 'healthy', 'unhealthy') NOT NULL DEFAULT 'unknown',
  health_message VARCHAR(500) NULL,
  last_health_checked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_ai_providers_runtime (status, is_default, updated_at),
  KEY idx_ai_providers_driver (driver)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

字段原则：

- `driver` 第一版只允许 `openai-compatible`，避免为不存在的 provider 抽象十层。
- `base_url` 入库保存规范化后的 `/v1` 根地址。
- `api_key_ciphertext`、`api_key_iv`、`api_key_auth_tag` 全部使用 base64 文本；明文 Key 永不入库。
- `api_key_version` 用于未来密钥轮换。P6 只写当前版本，不做批量轮换工具。
- `status` 控制是否可用；`health_status` 只描述最近一次健康检查结果，不替代启停状态。
- `is_default` 由服务层维护同一时间最多一个默认启用 provider。

### `ai_provider_models`

```sql
CREATE TABLE IF NOT EXISTS ai_provider_models (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  provider_id VARCHAR(36) NOT NULL,
  model_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  last_seen_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_ai_provider_models_provider_model (provider_id, model_id),
  KEY idx_ai_provider_models_runtime (provider_id, enabled, is_default, updated_at),
  CONSTRAINT fk_ai_provider_models_provider FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

字段原则：

- `model_id` 是供应商真实模型 ID，用于 API 请求。
- `display_name` 是 UI 展示名，第一版默认等于 `model_id`。
- `enabled` 控制工作台是否可以使用该模型。
- `is_default` 由服务层维护每个 provider 最多一个默认模型。
- `last_seen_at` 记录刷新模型列表时供应商仍返回该模型。

## 密钥加密设计

新增 server-only 模块：`src/lib/server/secret-encryption.ts`。

加密规则：

```text
算法：AES-256-GCM
主密钥：AI_CONFIG_MASTER_KEY
主密钥格式：base64，解码后必须正好 32 bytes
IV：每次加密随机 12 bytes
Auth tag：GCM 认证标签 16 bytes
字段编码：ciphertext / iv / auth_tag 全部 base64
```

服务函数：

```ts
export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  version: number;
};

export function encryptSecret(plaintext: string, env?: Record<string, string | undefined>): EncryptedSecret;
export function decryptSecret(secret: EncryptedSecret, env?: Record<string, string | undefined>): string;
```

错误原则：

- `AI_CONFIG_MASTER_KEY` 缺失时，不能保存数据库 AI Key。
- 主密钥长度不是 32 bytes 时直接报错。
- 明文 Key 为空时直接报错。
- 解密失败时直接报错，并让调用方回退 env 或返回配置错误。
- 不用 `|| ""` 或 `?? ""` 掩盖 Key、Base URL、model 缺失。

## 服务模块边界

### `src/lib/server/ai-provider-settings.ts`

负责数据库读写和运行时配置解析：

- `saveAIProviderSettings(input, runner?, env?)`：保存或更新 provider，API Key 用 AES-256-GCM 加密。
- `listAIProviderSettings(runner?)`：返回 provider 列表，只返回 `hasApiKey: true/false`，不返回密文字段，不返回明文。
- `getAIProviderSettings(providerId, runner?)`：返回单个 provider 的安全视图。
- `resolveRuntimeAIProviderConfig(runner?, env?)`：读取默认启用 provider + 默认启用 model，解密 Key，返回 provider 调用需要的 `apiKey/baseUrl/model`。
- `refreshAIProviderModels(providerId, fetchImpl?, runner?, env?)`：用解密后的 Key 调用 `/models`，upsert 模型列表。
- `checkAIProviderHealth(providerId, fetchImpl?, runner?, env?)`：调用模型列表接口做轻量健康检查，并更新 `health_status`。

返回给前端或未来管理端的安全视图：

```ts
export type AIProviderSettingsView = {
  id: string;
  name: string;
  driver: "openai-compatible";
  baseUrl: string;
  status: "enabled" | "disabled";
  isDefault: boolean;
  healthStatus: "unknown" | "healthy" | "unhealthy";
  healthMessage: string | null;
  lastHealthCheckedAt: string | null;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
};
```

运行时配置内部类型：

```ts
export type RuntimeAIProviderConfig = {
  provider: "openai-compatible";
  apiKey: string;
  baseUrl: string;
  model: string;
};
```

### `src/lib/ai-provider.ts`

保留 provider 编排，但生产配置来源改为：

```text
开发 / 测试：继续允许 request modelConfig 覆盖，用于本地调试。
生产：忽略浏览器 apiKey/baseUrl/model；优先 DB runtime config；失败时回退 env。
```

`convertWithOpenAICompatible` 和 `convertWithOpenAIResponses` 不应该知道数据库表结构。它们只接收解析后的 API Key、Base URL 和 model。数据库读取放在 server service，避免 provider 函数变成大泥球。

## API 与 UI 合约

P6 不新增公开管理页面。

现有 `/api/convert` 合约不变：

```text
POST /api/convert
body: { title, text, modelConfig? }
return: { yaml, report } 或 { error }
```

生产环境仍不接受浏览器覆盖：

```text
browser modelConfig.apiKey  -> ignored
browser modelConfig.baseUrl -> ignored
browser modelConfig.model   -> ignored
browser provider: mock      -> rejected
```

现有 `/api/models` 合约保留：

- `POST /api/models`：开发环境继续支持浏览器临时 API Key 获取模型列表。
- 生产环境继续拒绝浏览器传入 API Key 获取模型列表。

P6 可新增 server-only 服务 `refreshAIProviderModels`，但不新增公开刷新接口。需要页面入口时，再单独设计受控平台配置页。

## 错误处理

- 数据库无启用 provider：回退 env。
- 数据库读取失败：回退 env。
- 数据库 provider 有配置但解密失败：回退 env，并在日志/错误信息中显示“数据库 AI 配置不可用”。测试里只验证回退或错误，不打印密文字段。
- 数据库有 provider 但没有启用 model：回退 env。
- env 也缺少 Key：沿用 `OPENAI_COMPATIBLE_API_KEY 未配置`。
- 模型列表刷新失败：provider `health_status` 更新为 `unhealthy`，`health_message` 存短错误，不存响应 body 全量内容。
- AI 返回坏 YAML / JSON：仍由现有 Schema 校验错误处理。

这里的 fallback 不是掩盖 bug，而是兼容性策略：P6 不能让已有 env-only 部署在迁移数据库配置前直接瘫痪。

## 测试要求

必须覆盖：

1. schema 包含 `ai_providers` 和 `ai_provider_models` 表、关键字段、索引和外键。
2. `encryptSecret` 同一明文多次加密产生不同 ciphertext 或 iv。
3. `decryptSecret` 能还原明文。
4. 错误主密钥长度会失败。
5. 解密使用错误主密钥会失败。
6. 保存 provider 时，DB 参数不包含明文 API Key。
7. provider 列表只返回 `hasApiKey`，不返回 ciphertext、iv、auth tag、明文。
8. runtime resolver 优先读取默认启用 DB provider 和默认启用 model。
9. runtime resolver 在 DB 无配置或查询失败时回退 env。
10. production `/api/convert` 使用 DB runtime config，不接受浏览器敏感覆盖。
11. development 请求级配置仍可覆盖，用于本地调试。
12. refresh models upsert 新模型，保留已有模型的启用状态。
13. health check 成功写 `healthy`，失败写 `unhealthy`。
14. 全量 `npm test`、`npm run lint`、`npm run build` 通过。

## 不做范围

P6 明确不做：

- 不做完整管理端 UI。
- 不做租户级自带 API Key。
- 不做 Key 明文展示或下载。
- 不做复杂 provider strategy。
- 不做 Redis。
- 不改变 Prompt 模板结构。
- 不改变 YAML Schema。

## 结论

值得做。当前特殊情况是：生产 AI 配置靠 env，后续又想维护 Key 和模型。如果继续堆 if，只会把 provider 调用、密钥、模型列表、健康检查混在一起。P6 的好品味做法是先把数据结构立住：provider、model、encrypted secret、runtime config resolver。这样代码路径短，也兼容旧部署。
