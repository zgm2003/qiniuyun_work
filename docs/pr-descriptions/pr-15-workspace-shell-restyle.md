# PR 15: style: restyle workspace shell

## 功能描述

将当前小说转剧本页面从深色“稿纸 / 演示页”风格，调整为更接近产品工作台的中性 SaaS / 管理台风格。

本 PR 只做工作台外壳和视觉层改造，不修改转换 API、AI provider、YAML Schema、章节解析、本地草稿或导出逻辑。

## 实现思路

- 在 `src/app/page.tsx` 增加轻量 sticky 顶部导航，提供工作台、AI 设置、项目草稿、质量报告的页面内锚点。
- 将页面主标题调整为“小说转剧本工作台”，弱化一次性 Demo 感。
- 在 `src/app/globals.css` 中按 `docs/style-guideline.md` 替换视觉 token：
  - 浅色优先。
  - 中性色。
  - 统一卡片、按钮、表单、状态标签、质量清单样式。
  - 保留 YAML / 日志等内容的等宽字体。
- 保留现有 class 体系，避免在本 PR 中引入 Tailwind、Ant Design 或 shadcn。

## 测试方式

```bash
npm test
npm run lint
npm run build
```

预期：

- 单元测试全部通过。
- ESLint 通过。
- Next.js 生产构建通过。

## 兼容性

- 不改变 `/api/convert` 请求结构。
- 不改变 mock / OpenAI-compatible provider 行为。
- 不改变 localStorage 草稿结构。
- 不改变 YAML Schema 或质量清单判断。
- 页面内 `id` 锚点只用于导航，不影响原有表单提交和转换流程。
