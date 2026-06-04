# AI 小说转剧本工具

把 3 个章节以上的小说文本转换为结构化 YAML 剧本初稿，并提供 YAML Schema 文档、校验和导出能力。

## 为什么选择这个题目

三天开发周期内，实时语音题的风险主要在麦克风、网络、ASR/TTS 延迟和不可控的现场效果。本项目选择“AI 小说转剧本工具”，因为它的输入输出稳定，容易自动测试，适合持续 PR / commit，也更适合录屏复现。

## 已实现功能

- 章节识别：支持 `第1章`、`第一章`、`Chapter 1` 等标题。
- 章节大纲预览：转换前展示识别到的章节标题、字数和正文预览。
- 输入校验：少于 3 个章节直接报错，不生成假结果。
- 剧本生成：默认使用确定性 mock provider，可无 API Key 完整演示。
- 真实 AI 接口：配置 `AI_PROVIDER=openai-compatible` 后调用 OpenAI 兼容 Chat Completions API。
- 模型配置面板：页面可为单次转换选择 provider、base URL、model、temperature 和一次性 API Key。
- 本地项目草稿：可在浏览器 localStorage 保存、加载、删除当前小说/YAML/转换报告。
- YAML Schema：使用 Zod 定义运行时 Schema，并提供设计说明文档。
- YAML 编辑与校验：页面内编辑 YAML，实时显示 Schema 校验结果。
- 剧本质量清单：把 Schema 与结构检查转成可读 checklist，提示哪些交付项已通过。
- 导出：只有 YAML 校验通过时才允许导出。
- 转换总结：展示章节数、角色数、场景数、台词数和校验状态。

## 原创功能范围

本项目原创部分包括：

- 小说章节切分逻辑。
- 章节大纲预览数据结构和展示逻辑。
- 剧本 YAML Schema 设计。
- YAML 运行时校验和错误路径展示。
- 剧本结构质量清单，不做 AI 主观剧情评分。
- mock 剧本转换器。
- OpenAI-compatible provider 编排。
- 请求级模型配置，不破坏默认 mock 演示流程。
- 浏览器本地草稿管理，不保存 API Key 和模型配置。
- 转换 API。
- 前端输入、转换、编辑、校验、导出闭环。
- 示例小说、示例输出和录屏流程。

第三方库只提供框架、类型、校验和 YAML 解析能力，不包含现成的小说转剧本业务逻辑。


## 后续 Roadmap

当前版本是 MVP，不是最终产品。后续增强方向包括局部重写、质量评分、文件导入、登录系统、管理端、团队协作和异步任务队列。

详细 TODO 见 `docs/future-roadmap.md`。

## 依赖

运行依赖：

- Next.js
- React
- yaml
- zod

开发依赖：

- TypeScript
- Vitest
- ESLint
- eslint-config-next

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://localhost:3000
```

## 测试与构建

```bash
npm test
npm run lint
npm run build
```

## AI Provider 配置

默认使用 mock provider，适合录屏和无网络演示：

```env
AI_PROVIDER=mock
```

如果要调用 OpenAI 兼容接口：

```env
AI_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=your_api_key
OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
OPENAI_COMPATIBLE_MODEL=gpt-4.1-mini
```

真实 AI 返回内容仍然必须通过本项目 YAML Schema 校验。校验失败会报错，不会静默兜底。Base URL 可以填写服务根地址或 `/v1` 地址，系统会在缺少 `/v1` 时自动补齐。

页面上的“模型配置”面板可以覆盖 `.env` 中的 provider/base URL/model/temperature。API Key 只随本次 `/api/convert` 请求发送，不写入仓库，也不进入 localStorage 草稿。

## 本地项目草稿

页面提供“本地项目草稿”区域，支持：

- 保存当前标题、小说正文、YAML 剧本和转换报告。
- 刷新页面后从当前浏览器继续加载草稿。
- 删除草稿但不清空当前编辑区。

草稿只写入浏览器 localStorage，不上传服务端，也不保存 API Key、Base URL、model、provider 或 temperature。

## 录屏演示步骤

1. 启动项目：`npm run dev`。
2. 打开首页。
3. 点击“加载样例”。
4. 确认“章节大纲预览”显示 3 章、每章标题、字数和正文预览。
5. 展示“模型配置”面板：默认 `mock`，也可切到 `openai-compatible` 输入一次性 API Key。
6. 点击“转换为 YAML 剧本”。
7. 展示生成的 YAML、Schema 校验和“剧本质量清单”全部通过。
8. 展示角色、场景、台词统计。
9. 点击“保存为新草稿”，刷新页面后加载草稿，展示本地持久化。
10. 删除草稿，说明当前编辑区不会被清空。
11. 手动删除 `metadata.title`，展示 Schema 校验失败和质量清单对应失败项。
12. 恢复字段，展示 Schema 校验通过。
13. 点击“导出 YAML”。
14. 打开 `docs/script-yaml-schema.md` 说明 Schema 设计原因。

## 样例文件

- `samples/novel-3chapters.txt`：3 章小说输入样例。
- `samples/output.yaml`：mock provider 生成的 YAML 剧本样例。

## 持续交付记录

本项目按小粒度 commit 推进，避免最后一天突击导入：

1. `docs: define project direction and delivery plan`
2. `chore: initialize nextjs project scaffold`
3. `feat: add chapter parsing`
4. `feat: define script yaml schema`
5. `feat: add deterministic script converter`
6. `feat: build novel to script interface`
7. `feat: add ai provider selection`
8. `docs: add demo and pr workflow`
9. `feat: add model configuration panel`
10. `fix: harden openai compatible provider contract`
11. `fix: accept mislabeled provider json responses`
12. `feat: add local project drafts`
13. `feat: add chapter outline preview`
14. `feat: add script quality checklist`

## PR 规范

每个 PR 只做一件事。PR 描述必须包含：

- 功能描述
- 实现思路
- 测试方式
- 是否引用第三方依赖
- 是否复用历史代码

模板见 `.github/PULL_REQUEST_TEMPLATE.md`。
