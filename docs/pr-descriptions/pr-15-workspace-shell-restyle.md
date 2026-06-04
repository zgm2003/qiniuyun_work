# PR 15: refactor/style: split workspace into routed pages

## 功能描述

将当前拥挤的单页小说转剧本界面拆成多个 App Router 路由，并把视觉风格调整为更接近产品工作台的中性 SaaS / 管理台风格。

本 PR 不修改 `/api/convert`、YAML Schema、章节解析、本地草稿结构或导出逻辑；新增 `/api/models` 只用于根据当前 OpenAI-compatible 配置读取供应商模型列表。

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
- 新增共享 UI 控件：`UiSelect`、`UiButton`、`UiDialog`，先替换工作台 Provider 原生下拉，避免浏览器默认下拉样式破坏产品感。
- 新增 OpenAI-compatible 模型列表能力：
  - 服务端 `POST /api/models` 代理请求供应商 `GET /v1/models`。
  - 工作台可用当前 Base URL 和一次性 API Key 拉取模型 ID。
  - 拉取成功后 Model 字段从手填切换为产品内下拉，失败时保留手填路径并展示真实错误。
  - API Key 只随本次请求发送，不写入 localStorage 草稿。
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
- Next.js 生产构建通过，并生成 `/`、`/workspace`、`/script`、`/drafts`、`/report` 和 `/api/models` 路由。

## 兼容性

- 不改变 `/api/convert` 请求结构。
- 不改变底层 OpenAI-compatible 转换行为；仅抽出 base URL 规范化供转换与模型列表复用。
- 新增 `/api/models` 不保存 API Key，只作为当前请求的服务端代理。
- 测试用确定性转换器仍保留给测试、CI 和样例输出，但不出现在产品 UI。
- 不改变 localStorage 草稿结构。
- 不改变 YAML Schema 或质量清单判断。
- 不保存 API Key 到本地草稿。
- 路由拆分只改变信息架构；转换链路仍然是“输入小说 → 生成 YAML → 校验 → 保存草稿 → 导出”。
