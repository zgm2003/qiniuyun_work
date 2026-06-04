# PR 15: refactor/style: split workspace into routed pages

## 功能描述

将当前拥挤的单页小说转剧本界面拆成多个 App Router 路由，并把视觉风格调整为更接近产品工作台的中性 SaaS / 管理台风格。

本 PR 不修改转换 API、AI provider、YAML Schema、章节解析、本地草稿结构或导出逻辑。

## 实现思路

- 将根路由 `/` 改为轻量产品入口页。
- 新增 workbench 路由组：
  - `/workspace`：小说输入、模型配置、章节大纲、生成按钮。
  - `/script`：YAML 编辑、Schema 校验、质量清单、导出。
  - `/drafts`：本地草稿保存、加载、删除。
  - `/report`：转换总结和质量报告。
- 新增 `WorkspaceProvider`，在 workbench route group 内共享当前项目状态，避免路由切换丢失输入、YAML 和草稿状态。
- 新增 `WorkbenchShell`，统一顶部导航和工作台布局。
- 产品 UI 的 provider 选项只暴露 OpenAI-compatible，不展示测试用 provider。
- 在 `src/app/globals.css` 中按 `docs/style-guideline.md` 替换视觉 token：
  - 浅色优先。
  - 中性色。
  - 统一卡片、按钮、表单、状态标签、质量清单样式。
  - 保留 YAML / 日志等内容的等宽字体。
- 不引入 Tailwind、Ant Design 或 shadcn，避免在路由拆分 PR 中混入 UI 框架迁移。

## 测试方式

```bash
npm test
npm run lint
npm run build
```

预期：

- 单元测试全部通过。
- ESLint 通过。
- Next.js 生产构建通过，并生成 `/`、`/workspace`、`/script`、`/drafts`、`/report` 路由。

## 兼容性

- 不改变 `/api/convert` 请求结构。
- 不改变底层 OpenAI-compatible provider 行为。
- 测试用确定性转换器仍保留给测试、CI 和样例输出，但不出现在产品 UI。
- 不改变 localStorage 草稿结构。
- 不改变 YAML Schema 或质量清单判断。
- 不保存 API Key 到本地草稿。
- 路由拆分只改变信息架构；转换链路仍然是“输入小说 → 生成 YAML → 校验 → 保存草稿 → 导出”。
