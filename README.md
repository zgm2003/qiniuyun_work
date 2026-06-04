# AI 小说转剧本工具

把 3 个章节以上的小说文本转换为结构化 YAML 剧本初稿，并提供 YAML Schema 文档、校验和导出能力。

## 开发状态

当前处于项目骨架阶段。后续按 `docs/pr-plan.md` 拆分 PR / commit 持续交付。

## 依赖

- Next.js
- React
- TypeScript
- Zod
- yaml
- Vitest

## 本地运行

```bash
npm install
npm run dev
```

## 原创功能范围

本项目原创部分包括章节切分、剧本 YAML Schema、转换编排、mock provider、校验交互和演示流程。第三方库只提供框架、类型、校验和 YAML 解析能力。
