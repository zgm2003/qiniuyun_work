# PR 03 YAML Schema

## 标题

定义剧本 YAML Schema 和校验文档

## 功能描述

新增剧本结构 Schema、YAML parse/stringify、字段错误路径展示和设计说明文档。

## 实现思路

使用 Zod 做运行时校验。字段缺失直接失败，不使用默认空字符串兜底。

## 测试方式

- `npm test`
- `npm run lint`
- `npm run build`
