# PR / Commit 交付记录

比赛要求持续 PR 和 commit，不能最后一天一次性导入。本项目按“小 PR、单一职责、合并后主分支可运行”的方式推进。

## 已完成 PR 主线

| 序号 | 类型 | 标题 | 作用 |
| --- | --- | --- | --- |
| 1 | docs/chore | project direction + scaffold | 明确选题方向，初始化 Next.js/TypeScript 工程。 |
| 2 | feat | chapter parsing | 识别 3 章以上小说输入，少于 3 章直接拒绝。 |
| 3 | feat | script YAML schema | 定义 YAML 剧本结构和运行时校验。 |
| 4 | feat | deterministic converter | 加入 mock provider，保证无 API Key 稳定演示。 |
| 5 | feat | novel-to-script interface | 完成输入、转换、编辑、校验、导出闭环。 |
| 6 | feat | AI provider selection | 接入 mock / OpenAI-compatible provider。 |
| 7 | docs | demo and PR workflow | 补录屏脚本、依赖说明、原创功能说明。 |
| 8 | feat | model configuration panel | 页面支持 provider、base URL、model、temperature、一次性 API Key。 |
| 9 | fix | OpenAI-compatible provider contract | 强化 `/v1`、Prompt Schema 和非 JSON 错误提示。 |
| 10 | fix | mislabeled provider JSON | 兼容 body 是 JSON 但 Content-Type 标成 `text/event-stream` 的服务。 |
| 11 | feat | local project drafts | 浏览器 localStorage 保存、加载、删除项目草稿。 |
| 12 | feat | chapter outline preview | 转换前展示章节标题、字数和正文预览。 |
| 13 | feat | script quality checklist | 将 Schema 和结构检查展示为可读质量清单。 |
| 14 | feat | novel text file import | 浏览器本地导入 `.txt` / `.md` 小说文本。 |
| 15 | docs | final demo polish | 整理最终演示指南、README 主线和 Roadmap。 |

## 合并规则

- 每个 PR 只做一件事。
- 每个功能 PR 先写可测试的纯函数，再接 UI。
- 真实 AI 能力不能破坏默认 mock 演示。
- API Key 不写仓库，不存 localStorage 草稿。
- 每次合并回 `main` 后都运行：

```bash
npm test
npm run lint
npm run build
```

## 当前最终演示链路

```text
导入 .txt / .md 小说
↓
章节解析 + 大纲预览
↓
选择 mock 或 OpenAI-compatible 模型
↓
生成 YAML 剧本
↓
Schema 校验 + 质量清单
↓
保存本地草稿
↓
导出 YAML
```
