# PR 02 章节切分能力

## 标题

新增小说章节切分和最少 3 章校验

## 功能描述

支持中文和英文章节标题识别，并在章节数少于 3 时抛出明确错误。

## 实现思路

用纯函数 `parseNovelChapters` 处理输入文本，用 `requireMinimumChapters` 执行业务硬约束。错误不在 UI 层吞掉。

## 测试方式

- `npm test`
- `npm run lint`
- `npm run build`
