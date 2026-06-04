# PR 04 确定性转换器

## 标题

新增 mock 小说转剧本转换器和样例文件

## 功能描述

在无 API Key 情况下，把 3 章小说稳定转换为通过 Schema 的 YAML 剧本。

## 实现思路

从章节、角色名、首句动作生成可预测剧本结构，保证录屏和评审复现稳定。

## 测试方式

- `npm test`
- `npm run lint`
- `npm run build`
