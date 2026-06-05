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
| 3 | feat | database foundation | 后续 PR 接入最小 MySQL 持久化；Redis 仅在异步/限流需求出现时再单独评估。 |
| 4 | feat | auth foundation | P4：登录、会话、用户隔离和服务端项目列表；不破坏未登录题目三演示闭环。 |
| 5 | feat | prompt template management | P5：将硬编码提示词迁移为固定变量模板，输出仍受 YAML Schema 约束。 |
| 6 | feat | encrypted AI provider settings | P6：AI 供应商、模型、健康检查入库，API Key 使用 AES-256-GCM 加密。 |
| 7 | feat | RBAC and admin shell | P7：为 Prompt 模板和 AI 供应商配置提供最小管理端权限边界。 |

## 产品化阶段已推进

| 序号 | 类型 | 标题 | 作用 |
| --- | --- | --- | --- |
| P1 | docs | product architecture and style guideline | 明确产品化架构边界和后续 UI 改动规则。 |
| P2 | refactor/style | routed workspace shell | 将拥挤单页拆成 `/workspace`、`/script`、`/drafts`、`/report`，并调整为中性 SaaS / 管理台风格。 |
| P3 | feat | database foundation | 接入 MySQL 基础持久化，保存项目、剧本版本和生成记录；localStorage 草稿保留，Redis/Auth/RBAC 后置。 |
| P4 | planned | auth project ownership | 登录、会话、用户隔离和服务端项目列表；未登录仍可完成小说转 YAML 剧本演示闭环。 |

## 下一阶段计划

### PR 16：登录、用户隔离和服务端项目列表

目标：让作者登录后保存和恢复自己的小说改编项目，不破坏未登录演示流程。

验收：

- 未登录仍可完成小说转 YAML 剧本、编辑、校验、导出。
- 登录用户可以保存当前工作区到服务端。
- `/projects` 只展示当前用户项目。
- 用户不能加载或写入其他用户项目。

### PR 17：Prompt 模板化

目标：把当前写在代码里的 Prompt 拆成固定变量模板，仍然强制通过 `ScriptDocument` / YAML Schema 校验。

### PR 18：AI 供应商配置加密入库

目标：AI Base URL、模型和 Key 入库；Key 使用 AES-256-GCM 加密，主密钥只来自服务端 env，前端只显示 masked 状态。


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
