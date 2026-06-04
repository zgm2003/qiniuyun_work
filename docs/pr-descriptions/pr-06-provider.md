# PR 06 AI Provider 选择

## 标题

新增 mock / OpenAI-compatible Provider 选择

## 功能描述

默认使用 mock provider，配置环境变量后可调用 OpenAI 兼容 Chat Completions API。

## 实现思路

使用 `convertNovelWithProvider` 做唯一编排入口。真实 AI 输出仍必须经过 YAML Schema 校验，失败则返回错误。

## 测试方式

- `npm test`
- `npm run lint`
- `npm run build`
