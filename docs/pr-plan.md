# PR / Commit 交付记录

比赛要求持续 PR 和 commit，不能最后一天一次性导入。本项目按“小 PR、单一职责、合并后主分支可运行”的方式推进。

## 已完成 PR 主线

| 序号 | 类型 | 标题 | 作用 |
| --- | --- | --- | --- |
| 1 | docs/chore | project direction + scaffold | 明确选题方向，初始化 Next.js/TypeScript 工程。 |
| 2 | feat | chapter parsing | 识别 3 章以上小说输入，少于 3 章直接拒绝。 |
| 3 | feat | script YAML schema | 定义 YAML 剧本结构和运行时校验。 |
| 4 | feat | deterministic converter | 加入测试用确定性转换器，保证 CI 和样例输出稳定。 |
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
- 产品 UI 不暴露测试用 provider；确定性转换器只用于测试、CI 和样例输出。
- API Key 不写仓库，不存 localStorage 草稿。
- 每次合并回 `main` 后都运行：

```bash
npm test
npm run lint
npm run build
```

## 产品化阶段 PR 拆分

比赛 MVP 收尾后，后续大改继续按小 PR 推进，不能把 UI、数据库、登录、管理端和 Prompt 系统一次性塞进一个 PR。

| 顺序 | 类型 | 标题 | 作用 |
| --- | --- | --- | --- |
| 1 | docs | product architecture and style guideline | 明确产品化架构、样式规则和后续 AI 改动边界。 |
| 2 | style | restyle workspace shell | 参考中性 SaaS / 管理台风格重做工作台外观，不改业务行为。 |
| 3 | feat | database foundation | 接入 MySQL / Redis，增加健康检查和初始化脚本。 |
| 4 | feat | auth foundation | 加入登录、密码哈希、JWT/session 和当前用户接口。 |
| 5 | feat | RBAC and admin shell | 加入 admin/member 权限边界和管理端骨架。 |
| 6 | feat | AI provider settings | 将 AI 供应商、模型、健康检查从单次配置升级为可管理资源。 |
| 7 | feat | prompt template management | 将硬编码提示词迁移为可配置模板，并保留 Schema 校验硬约束。 |

## 产品化阶段已推进

| 序号 | 类型 | 标题 | 作用 |
| --- | --- | --- | --- |
| P1 | docs | product architecture and style guideline | 明确产品化架构边界和后续 UI 改动规则。 |
| P2 | refactor/style | routed workspace shell | 将拥挤单页拆成 `/workspace`、`/script`、`/drafts`、`/report`，并调整为中性 SaaS / 管理台风格。 |

## 当前最终演示链路

```text
导入 .txt / .md 小说
↓
章节解析 + 大纲预览
↓
配置 OpenAI-compatible 模型
↓
生成 YAML 剧本
↓
Schema 校验 + 质量清单
↓
保存本地草稿
↓
导出 YAML
```
