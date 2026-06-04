# PR 14: docs: add product architecture and style guideline

## 功能描述

补充产品化阶段的架构说明和样式 guideline，为后续 UI 大改、数据库接入、登录、管理端、AI 供应商配置和 Prompt 模块化提供统一边界。

本 PR 不修改运行代码，不改变当前比赛演示链路。

## 实现思路

- 新增 `docs/product-architecture.md`，明确 Next.js 继续承载当前阶段产品化骨架，并定义用户端、管理端、数据库、Redis、AI provider 和 Prompt 模板的边界。
- 新增 `docs/style-guideline.md`，参考 `E:\admin_go\canvas_front_next` 的中性 SaaS / 管理台风格，定义颜色、字体、布局、组件和后续 AI 改 UI 的约束。
- 更新 PR 交付记录，把产品化大改拆成后续独立 PR，避免一次性巨型改动。

## 测试方式

文档 PR 不改业务代码，验证方式：

```bash
npm test
npm run lint
npm run build
```

预期：

- 单元测试全部通过。
- ESLint 通过。
- Next.js build 通过。

## 风险与兼容性

- 不修改 API、页面、Schema 或 provider 行为。
- 不破坏当前 mock / OpenAI-compatible 演示能力。
- 后续 PR 需遵守文档定义的小步交付顺序。
