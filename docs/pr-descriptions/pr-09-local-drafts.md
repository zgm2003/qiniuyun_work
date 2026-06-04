# PR 9: feat: add local project drafts

## 标题

feat: add local project drafts

## 功能描述

新增浏览器本地项目草稿能力。用户可以保存当前标题、小说正文、YAML 剧本和转换报告；刷新页面后可以加载草稿；也可以删除草稿且不清空当前编辑区。

## 实现思路

- 新增 `src/lib/local-drafts.ts`，用版本化 `LocalProjectDraft` 数据结构封装 localStorage 读写。
- 草稿只保存作品状态，不保存 API Key、Base URL、model、provider 或 temperature。
- 页面使用 `useSyncExternalStore` 订阅 localStorage 快照，避免在 effect 中同步 setState。
- 新增本地草稿 UI：保存/更新、加载、删除、当前草稿提示。

## 测试方式

```bash
npm test
npm run lint
npm run build
```

手工验证：

1. 启动 `npm run dev`。
2. 转换样例小说。
3. 点击“保存为新草稿”。
4. 刷新页面，确认草稿仍存在。
5. 点击“加载”，确认标题、小说、YAML 和转换报告恢复。
6. 点击“删除”，确认草稿消失但当前编辑区不被清空。

## 第三方依赖

未新增第三方依赖。继续使用项目已有的 Next.js、React、Vitest、Zod、yaml。

## 原创功能说明

本 PR 的草稿数据结构、localStorage 持久化逻辑、页面交互和测试均为本项目新增实现。
