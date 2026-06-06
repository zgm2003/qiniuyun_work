# 项目库入库能力可见化设计

## 需求判断

这是真问题。当前 MySQL 已经保存了 `projects`、`script_versions`、`generation_runs`、`ai_settings`，但用户在主流程里只能明显看到 AI 配置；项目库入口被藏在路由里，生成记录只写不读。结果是“数据确实入库了”，但演示和日常使用都看不出入库价值。

## 核心问题

需要把已经存在的持久化能力变成用户可见的产品能力：

1. 作者知道当前工作区是否绑定了数据库项目。
2. 作者能从主流程手动保存到项目库。
3. 作者能从顶部导航进入项目库。
4. 作者能在项目库看到最近一次生成使用的模型、状态和错误。

这不是建设后台管理系统，也不是增加新的数据库表。

## 非目标

- 不恢复 `ai_providers + ai_provider_models` 两表设计。
- 不把临时获取的模型列表入库。
- 不做多供应商、多模型管理后台。
- 不展示 `prompt_templates`。它是内部运行配置，不是作者当前需要操作的资产。
- 不新增账号、权限、回收站、搜索、分页、项目详情页。

## 方案比较

### 方案 A：只在 README 写清楚

成本最低，但没有解决产品问题。用户仍然看不到数据库行为，只能相信文档。

结论：不选。

### 方案 B：做完整“数据后台”

展示项目、版本、生成记录、提示词、AI 配置等所有表。

问题是过度设计。题目是 AI 小说转剧本工具，不是数据库管理系统。把内部表都暴露出来会增加认知负担，也会把后续设计绑死。

结论：不选。

### 方案 C：只暴露作者真正关心的入库证据

顶部导航增加“项目库”；工作台生成卡片增加“保存到项目库”和绑定状态；项目库卡片展示最近一次生成记录。`generation_runs` 从“只写不读”变成“生成审计摘要”。

结论：选择这个方案。它用最少 UI 暴露最关键的数据库价值，不改变已有主流程。

## 数据结构

保持现有表结构不变，只扩展读取模型：

```ts
export type GenerationRunSummary = Pick<
  GenerationRunRecord,
  "id" | "provider" | "model" | "status" | "errorMessage" | "createdAt"
>;

export type ProjectListItem = Pick<ProjectRecord, "id" | "title" | "status" | "createdAt" | "updatedAt"> & {
  latestGenerationRun: GenerationRunSummary | null;
};
```

设计原因：

- `projects` 仍然是用户看到的主资产。
- `script_versions` 仍然只通过“最新 YAML”体现，不在列表页做版本管理。
- `generation_runs` 只作为项目卡片上的最近生成摘要出现，避免引入运行记录列表页。
- `latestGenerationRun: null` 是合法业务状态：项目可能只保存了草稿，还没生成过。

## API 兼容性

`GET /api/projects` 保持原有返回结构：

```json
{
  "projects": []
}
```

只给每个 project 增加 `latestGenerationRun` 字段。旧字段不改名、不删字段、不改变语义。这是向后兼容的增量。

`POST /api/projects`、`PATCH /api/projects/[projectId]`、`POST /api/convert` 不改请求结构。

## UI 设计

### 顶部导航

`WORKBENCH_NAV_ITEMS` 从两个可见入口变为三个：

1. 工作台
2. 项目库
3. 编辑 YAML

`/drafts` 和 `/report` 继续作为路由支持，但不进入顶部主导航。它们不是这次要展示的“数据库能力”。

### 工作台

在“生成准备”卡片中加入一个轻量的“项目库存储”区域：

- 未绑定时显示“当前未绑定项目库项目”。
- 点击“保存到项目库”会调用已有 `saveCurrentWorkspaceToServer()`。
- 生成时继续沿用现有逻辑：先创建或更新项目，再生成 YAML，再保存版本和生成记录。
- 生成成功后使用现有 `serverProjectMessage` 告知“已生成并保存 YAML 版本”。

这能让用户知道：入库不是隐藏副作用，而是当前工作流的一部分。

### 项目库

每个项目卡片展示：

- 标题。
- 更新时间与项目状态。
- 最近生成记录：状态、模型、时间。
- 如果最近生成失败，展示错误摘要。
- 没有生成记录时展示“暂无生成记录”。

这直接解释 `generation_runs` 为什么存在。

## 错误处理

- 读取项目失败继续使用现有 `message` 展示。
- `latestGenerationRun: null` 不报错，这是正常草稿状态。
- 失败运行记录展示 `errorMessage`，但不影响打开项目。
- 不为缺失字段发明默认模型；如果数据库里的运行记录没有 model，服务层仍按现有 `recordGenerationRun()` 的校验报错，读取层不兜底。

## 测试策略

- `workbench-nav.test.ts`：证明“项目库”进入顶部导航，路由匹配仍兼容。
- `workspace-page.test.ts`：证明主工作台可见“保存到项目库”和绑定状态。
- `projects.test.ts`：证明 `listProjects()` 会返回每个项目最近一次生成记录。
- `route.test.ts` / `server-projects-client.test.ts`：证明新增字段被透传，旧请求结构不变。
- 新增纯展示 helper 测试：证明生成记录状态文案稳定。
- 最后跑 `npm test`、`npm run lint`、`npm run build`。

## 破坏性分析

- 数据库：不新增表，不改字段，不需要迁移。
- API：只加字段，不删字段。
- UI：顶部导航增加一个入口，原工作台和编辑页入口保留。
- 用户习惯：原“生成 YAML”路径不变，只增加可见保存入口。

## 验收标准

1. 顶部导航能看到“项目库”。
2. 工作台能看到“保存到项目库”和当前绑定状态。
3. 生成后项目库卡片能显示最近生成使用的 model 与成功/失败状态。
4. 失败生成的错误能在项目库卡片上体现。
5. 没有生成记录的草稿不会报错，显示“暂无生成记录”。
6. `ai_settings` 继续是唯一 AI 配置表，模型列表仍然只临时获取。
