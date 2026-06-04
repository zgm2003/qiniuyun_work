# PR 13: docs: polish final demo guide

## 标题

docs: polish final demo guide

## 功能描述

整理最终提交和录屏相关文档，让评委可以快速理解项目主线、已完成能力、演示步骤和后续 Roadmap。

## 实现思路

- 在 README 中补充最终交付主线，串起导入、章节预览、模型配置、YAML 生成、Schema 校验、质量清单、草稿和导出。
- 新增 `docs/final-demo-guide.md`，作为最终录屏前检查和演示顺序指南。
- 将 `docs/pr-plan.md` 从早期计划改成最终 PR / commit 交付记录。
- 重写 `docs/future-roadmap.md`，移除已经完成的待办项，保留下一阶段产品化方向。

## 测试方式

```bash
npm test
npm run lint
npm run build
```

## 第三方依赖

未新增第三方依赖。

## 原创功能说明

本 PR 只整理项目文档，不新增运行时代码。
