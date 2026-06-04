# 产品化架构说明

当前仓库已经完成比赛演示闭环，但它还不是一个可运营产品。后续改动必须先把边界切清楚：哪些能力属于用户工作台，哪些能力属于管理端，哪些能力属于平台基础设施。否则登录、数据库、提示词、模型配置会继续堆进单页，复杂度失控。

## 架构判断

现阶段继续使用 Next.js 全栈方案。

原因很简单：

- 当前仓库已经是 Next.js 项目，比赛交付和录屏都依赖它。
- App Router、Route Handler、Server Component、Middleware 足够承载中等规模的工作台和管理端。
- 现在拆出 Go 后端会引入跨仓库接口、鉴权、部署和联调成本，短期收益不够。

如果后续业务已经明确接入既有 `admin_go` 后端生态，再迁移成“Next.js 前端 + Go 后端”也可以。但那是独立阶段，不应该混在当前产品化第一阶段里。

## 目标形态

```text
用户登录
↓
进入小说改编工作台
↓
创建 / 导入小说项目
↓
选择可用 AI 供应商和 Prompt 模板
↓
生成结构化 YAML 剧本
↓
校验、修订、版本化保存
↓
导出 YAML / Markdown / 其他格式
```

管理端负责平台资源：

```text
用户管理
角色和权限
AI 供应商配置
模型列表和健康检查
Prompt 模板管理
调用日志
生成失败排查
```

## 推荐目录边界

```text
src/app/(workspace)      用户工作台页面
src/app/(admin)          管理端页面
src/app/(auth)           登录、注册、找回入口
src/app/api              API routes
src/components           通用 UI 组件
src/features/script      小说改编业务组件
src/features/admin       管理端业务组件
src/lib/ai               AI provider、prompt、转换流程
src/lib/auth             登录态、JWT、权限判断
src/lib/db               MySQL、Redis、迁移脚本入口
src/lib/script           章节、Schema、质量清单、导出
```

原则：

- `app` 只负责路由组合，不塞复杂业务逻辑。
- `features` 放页面相关业务组件。
- `lib` 放可测试的纯逻辑、数据库访问和服务编排。
- 测试优先覆盖 `lib`，UI 只测关键交互。

## 核心数据结构

第一阶段不要过度拆表。先保存能恢复用户工作的最小数据。

### 用户与权限

```text
users
- id
- email
- password_hash
- name
- status
- created_at
- updated_at

roles
- id
- code
- name

user_roles
- user_id
- role_id
```

RBAC 第一版只需要：

```text
admin
member
```

不要一开始做复杂 permission matrix。先解决真实问题：谁能进入管理端，谁只能管理自己的项目。

### 项目与版本

```text
projects
- id
- owner_user_id
- title
- source_text
- status
- created_at
- updated_at

script_versions
- id
- project_id
- yaml
- report_json
- validation_json
- created_by
- created_at
```

第一版保留完整 YAML 版本，不急着把每个 scene 拆成多张表。YAML 是当前产品的稳定协议，先不要破坏。

### AI 供应商

```text
ai_providers
- id
- name
- driver
- base_url
- api_key_ciphertext
- status
- health_status
- created_at
- updated_at

ai_provider_models
- id
- provider_id
- model_id
- display_name
- enabled
```

API Key 必须按敏感数据处理。没有密钥加密方案前，不要随便把明文 key 入库。

### Prompt 模板

```text
prompt_templates
- id
- code
- name
- scene
- system_prompt
- user_prompt_template
- schema_version
- status
- created_at
- updated_at
```

Prompt 模板可以被管理端维护，但运行时仍然必须通过 YAML Schema 校验。用户可配置不等于允许输出结构乱掉。

## MySQL 与 Redis 边界

MySQL 存放长期状态：

- 用户
- 项目
- 剧本版本
- AI 供应商
- Prompt 模板
- 调用记录

Redis 存放短期状态：

- 登录 token 黑名单或会话缓存
- 转换任务状态
- 限流计数
- 短期模型健康检查结果

不要把项目正文、剧本 YAML 这类长期资产塞进 Redis。

## AI provider 策略

产品路径只使用真实 AI provider。

但是测试层可以保留 mock：

- `mock` 用于单元测试、离线演示、CI。
- 用户产品界面默认不暴露 mock。
- API 层可以通过环境变量或测试注入使用 mock，但不能让生产用户误以为 mock 是真实生成。

这样不破坏当前比赛演示，也不把 mock 当产品能力卖。

## Prompt 模块化策略

当前 hardcoded prompt 应迁移为模板模块：

```text
默认系统 Prompt
默认用户 Prompt 模板
变量渲染
Schema 约束
输出清洗
YAML 校验
失败提示
```

模板变量第一版只支持固定集合：

```text
{{title}}
{{chapter_count}}
{{chapters}}
{{schema_summary}}
```

不要第一版引入任意脚本、复杂表达式或插件系统。Prompt 模板是配置，不是代码执行环境。

## PR 推进顺序

后续大改必须按小 PR 推进：

1. `docs: add product architecture and style guideline`
2. `style: restyle workspace shell`
3. `feat: add database foundation`
4. `feat: add auth foundation`
5. `feat: add RBAC and admin shell`
6. `feat: add AI provider settings`
7. `feat: add prompt template management`

每个 PR 合并后主分支都必须可运行。

## 不做什么

第一阶段明确不做：

- 不拆 Go 后端。
- 不上复杂微服务。
- 不一口气做完整权限矩阵。
- 不把 scene、dialogue、character 全部拆表。
- 不做多租户计费。
- 不做插件市场。
- 不把 mock 当生产能力。

这些不是永远不做，而是现在做会吞掉时间，并且不会让当前产品更稳定。
