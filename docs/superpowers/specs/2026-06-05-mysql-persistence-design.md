# MySQL 基础持久化设计

## 需求判断

P3 是真问题。当前项目已经能把 3 章以上小说转换成 YAML 剧本，但项目资产仍只存在浏览器 localStorage。上线后只靠 localStorage 会丢数据，也无法稳定保存项目草稿、YAML 版本和生成记录。

本阶段只做 MySQL 基础持久化，不做 Redis、账号体系、管理端，也不替换 localStorage 草稿。

## 核心问题

需要把三个核心资产入库：

1. `projects`：一份小说改编项目，拥有标题、原文、状态。
2. `script_versions`：某个项目的一次 YAML 剧本版本，连同报告和校验结果。
3. `generation_runs`：一次生成调用记录，记录供应商、模型、状态和错误。

第一版不拆 `scene`、`dialogue`、`character` 多张表。原因很简单：当前题目交付协议是 YAML，用户编辑的也是 YAML。过早拆表只会制造同步问题。

## 方案选择

### 推荐方案：原生 MySQL 驱动 + 小型 repository

使用 `mysql2` 连接池，写一个很薄的数据库模块和一个 `projects` 服务模块：

- `src/lib/db/mysql.ts`：创建和复用 MySQL 连接池。
- `src/lib/db/schema.sql`：初始化 SQL。
- `src/lib/server/projects.ts`：项目、剧本版本、生成记录的服务函数。
- API route 只做请求校验和响应，不写 SQL。

优点：

- 依赖少，结构清楚。
- 不引入 Prisma 迁移体系，避免本阶段复杂度膨胀。
- 对 Next.js API route 足够。

缺点：

- 需要手写 SQL 和测试替身。

### 不选方案：现在上 Prisma

Prisma 后续可用，但现在会引入 schema、generate、migration、client 生命周期等额外概念。项目数据模型很小。现在上 Prisma 不解决真实问题。

### 不选方案：同时做 Redis 异步任务

Redis 只有在长小说任务、限流、队列、进度查询出现时才是刚需。P3 的真实问题是“资产落库”，不是“异步任务”。

## 数据结构

```sql
CREATE TABLE projects (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  source_text MEDIUMTEXT NOT NULL,
  status ENUM('draft', 'generated', 'failed') NOT NULL DEFAULT 'draft',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_projects_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE script_versions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  yaml MEDIUMTEXT NOT NULL,
  report_json JSON NOT NULL,
  validation_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_script_versions_project_created (project_id, created_at),
  CONSTRAINT fk_script_versions_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE generation_runs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  model VARCHAR(255) NOT NULL,
  status ENUM('running', 'succeeded', 'failed') NOT NULL,
  error_message TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_generation_runs_project_created (project_id, created_at),
  CONSTRAINT fk_generation_runs_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## API 设计

### `POST /api/projects`

输入：

```json
{
  "title": "雨夜来信",
  "sourceText": "第1章 ..."
}
```

行为：

- `title` 去首尾空白后不能为空。
- `sourceText` 不能为空。
- 创建 project，状态为 `draft`。
- 返回 project。

### `POST /api/projects/[projectId]/versions`

输入：

```json
{
  "yaml": "metadata:\n  title: 雨夜来信\n...",
  "report": {
    "provider": "openai-compatible",
    "chapterCount": 3,
    "characterCount": 2,
    "sceneCount": 3,
    "dialogueLineCount": 3,
    "validationPassed": true
  }
}
```

行为：

- 先用现有 `validateScriptYaml` 校验 YAML。
- 校验失败返回 400，不入库。
- 校验通过则在同一个事务里保存版本，并把项目状态更新为 `generated`。插入版本成功但状态更新失败时必须回滚。
- `report_json` 保存转换报告。
- `validation_json` 保存校验结果。只保存当前结构，不发明默认值。


### `POST /api/projects/[projectId]/generation-runs`

输入：

```json
{
  "provider": "openai-compatible",
  "model": "gpt-5.5",
  "status": "succeeded",
  "errorMessage": null
}
```

行为：

- 记录一次生成运行的供应商、模型、状态和错误。
- `model` 不能为空。
- 本接口提供生成记录的真实入库边界，但本 P3 不自动接入 `/api/convert`，避免破坏当前转换返回结构和前端流程。后续如果接异步任务，再把转换请求和项目 ID 绑定。

## 错误处理

- 请求体不是 JSON：400。
- 字段不合法：400。
- YAML 校验失败：400。
- 数据库错误：500，返回明确但不泄漏 DSN 的错误信息。

数据库保存失败不能影响当前 YAML 编辑器里的内容。本阶段只新增服务端 API，不改变前端 localStorage 保存路径，因此天然满足这个约束。

## 配置

新增环境变量：

```env
MYSQL_DSN=mysql://app_user:app_password@127.0.0.1:3306/qiniuyun
MYSQL_CONNECTION_LIMIT=10
```

也兼容 Go 风格 DSN，例如 `app_user:example_password@tcp(host.docker.internal:3307)/qiniuyun?...`，转换为 `mysql2` 可用配置。这里使用示例口令，不复制其他项目的真实 DSN。

## 测试策略

- 数据库 DSN 解析使用纯函数单元测试，不碰真实 MySQL。
- `projects` 服务使用 fake repository 测试，证明入参校验、YAML 校验、状态更新和生成记录行为。
- API route mock 服务层，测试 400/201/500 响应。
- 不要求 CI 连接真实 MySQL，避免测试依赖外部容器。

## 兼容性

- 不改 `/api/convert` 返回结构。
- 不改现有 YAML Schema 字段语义。
- 不删除 localStorage 草稿。
- 不要求账号登录。
- 不引入 Redis。
