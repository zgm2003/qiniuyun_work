# PR 08 模型配置面板

## 标题

新增模型配置面板，支持单次转换选择 mock 或 OpenAI-compatible provider

## 功能描述

用户可以在页面中选择 `mock` 或 `openai-compatible` provider，并为单次转换配置 base URL、model、temperature 和一次性 API Key。默认仍使用 `mock`，无 API Key 也能完整录屏演示。

## 实现思路

- 在前端维护请求级模型配置状态。
- `/api/convert` 接收可选 `modelConfig`，旧 `{ title, text }` payload 保持兼容。
- `convertNovelWithProvider` 的 provider 解析顺序为：请求配置优先，其次环境变量，最后默认 mock。
- OpenAI-compatible provider 使用请求级 API Key/base URL/model/temperature 覆盖环境变量。
- mock provider 完全忽略真实模型配置，不调用 fetch。

## 测试方式

- `npm test`
- `npm run lint`
- `npm run build`
- 手动验证：默认 mock 转换正常；切到 openai-compatible 时缺 API Key 明确报错；切回 mock 后仍可稳定生成 YAML。

## 第三方依赖说明

无新增依赖。

## 代码来源说明

无复用历史代码。
