# 题目三 AI 小说转剧本工具验收清单

## 题目原文拆解

| 题目要求 | 项目实现 | 验收方式 |
| --- | --- | --- |
| 开发 AI 辅助剧本创作工具 | 工作台提供小说导入、模型配置、转换、审查、保存、导出闭环 | 打开 `/workspace`，按录屏流程操作 |
| 降低改编门槛，提升效率 | 作者不需要手写剧本结构，AI 先生成可编辑 YAML 初稿 | 导入 `samples/novel-3chapters.txt` 后生成 YAML |
| 能将 3 个章节以上小说文本转换 | `parseNovelChapters` 识别章节，`requireMinimumChapters` 拒绝少于 3 章输入 | 修改输入为 1 章，转换接口返回“至少需要 3 个章节” |
| 自动转换为结构化剧本 | `/api/convert` 调用 OpenAI-compatible provider，并要求输出固定剧本文档结构 | 生成结果包含 `metadata`、`characters`、`scenes`、`summary` |
| YAML 格式 | `stringifyScriptDocument` 输出 YAML，编辑器和导出均使用 YAML | 剧本审查页展示 YAML，导出文件为 `.yaml` |
| 作者可以快速获得可编辑初稿 | 页面提供 YAML 编辑器、Schema 校验、质量清单、项目保存和导出 | 修改 YAML 字段后实时看到校验结果 |
| 额外写 YAML Schema 文档 | `docs/script-yaml-schema.md` 定义字段、规则、示例和版本策略 | 打开文档查看顶层结构和字段定义 |
| 说明 Schema 设计原因 | 文档解释 YAML、metadata、characters、scenes、dialogue、summary 的设计理由 | 查看每个字段组下面的“设计原因”说明 |
| 现场可演示 | `docs/final-demo-guide.md` 给出演示步骤，`docs/demo-script.md` 给出口播稿 | 按 5 分钟口播节奏录屏或现场演示 |

## 项目主线

```text
导入小说文本
↓
章节识别与大纲预览
↓
配置 OpenAI-compatible 模型
↓
生成结构化 YAML 剧本
↓
Schema 校验 + 剧本质量清单
↓
项目库 / 本地草稿
↓
导出 YAML
↓
展示 Schema 文档
```

## 关键证据

- 章节解析：`src/lib/chapters.ts`
- 章节大纲：`src/lib/chapter-outline.ts`
- YAML Schema：`src/lib/script-schema.ts`
- Schema 文档：`docs/script-yaml-schema.md`
- 演示指南：`docs/final-demo-guide.md`
- 现场口播稿：`docs/demo-script.md`
- AI provider 编排：`src/lib/ai-provider.ts`
- 转换 API：`src/app/api/convert/route.ts`
- 模型列表 API：`src/app/api/models/route.ts`
- 工作台状态：`src/features/workspace/workspace-context.tsx`
- 工作台页面：`src/features/workspace/workspace-page.tsx`
- 剧本审查页面：`src/features/workspace/script-page.tsx`
- 项目库页面：`src/features/workspace/projects-page.tsx`
- 本地草稿：`src/lib/local-drafts.ts`
- 样例输入 TXT：`samples/novel-3chapters.txt`
- 样例输入 MD：`samples/novel-3chapters.md`
- 样例输出：`samples/output.yaml`

## 验收命令

```bash
npm test
npm run lint
npm run build
npm run dev
```

## 不把账号体系作为当前题目验收项

题目三的必要验收是小说转 YAML 剧本、Schema 文档和可编辑校验闭环。项目不需要账号体系、权限矩阵或管理端壳层来证明这个能力。

MySQL 保存完整项目草稿、YAML 版本、生成记录、Prompt 模板和平台级 AI 配置。Redis 只在长任务、限流或短期任务状态成为真实问题时再评估。
