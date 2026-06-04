# Future TODO / Roadmap

当前版本只是 MVP：能输入小说、生成 YAML、校验、导出。它证明方向可行，但还不是完整产品。后续要做的不是随便堆功能，而是围绕三个问题推进：

1. 作者能不能长期管理自己的改编项目？
2. 生成结果能不能稳定变好，而不是每次碰运气？
3. 评委能不能看出这是一个可扩展的 AI 创作系统，而不是一次性 Demo？

---

## P0：当前已完成能力

- [x] 3 章以上小说输入。
- [x] 章节切分。
- [x] mock provider，保证无 API Key 可演示。
- [x] OpenAI-compatible provider 接口。
- [x] YAML 剧本 Schema。
- [x] YAML 编辑、校验、导出。
- [x] 示例小说和录屏脚本。

这部分只能算底座，不能吹成完整产品。

---

## P1：三天内最值得补的作品增强

这些功能收益高、范围可控，适合继续拆成小 PR。

### 1. 模型配置面板

**目标**：用户不用改 `.env`，可以在页面选择 provider、base URL、model、temperature。

**价值**：评委能看到真实 AI 能力不是写死的。

**建议 PR 拆分**：

- `feat: add model configuration form`
- `feat: persist model settings locally`
- `feat: show active provider and model in conversion report`

**注意**：API Key 不要写入 git，不要展示明文。前端本地配置只适合 Demo；正式版必须走后端加密存储。

### 2. 项目草稿管理

**目标**：支持保存多个小说改编项目，包括标题、原文、生成 YAML、更新时间。

**第一版实现**：localStorage。

**后续正式版**：数据库。

**价值**：从“一次性转换器”升级成“创作工作台”。

**建议 PR 拆分**：

- `feat: add local project drafts`
- `feat: add draft list and restore action`
- `feat: add delete draft confirmation`

### 3. 生成结果二次修订

**目标**：用户可以选择某个 scene，让 AI 只重写这一场，而不是整篇重来。

**价值**：这是剧本工具的核心工作流。作者不会一次满意，他需要局部打磨。

**建议功能**：

- 重写台词。
- 强化冲突。
- 减少旁白。
- 增加镜头感。
- 改成喜剧 / 悬疑 / 短剧风格。

**建议 PR 拆分**：

- `feat: select scene for revision`
- `feat: add scene rewrite instruction`
- `feat: validate rewritten scene before merge`

### 4. 转换质量评分

**目标**：给每次生成结果一个可解释评分，而不是只显示数量。

**评分维度**：

- 章节覆盖率。
- 角色一致性。
- 场景完整度。
- 台词占比。
- Schema 通过率。
- 改编建议数量。

**价值**：让“AI 生成”变成“可量化改编反馈”。

**建议 PR 拆分**：

- `feat: add conversion quality metrics`
- `feat: display coverage and dialogue ratio`
- `feat: add actionable improvement suggestions`

### 5. 文件导入

**目标**：支持 `.txt` 上传，后续支持 `.docx`。

**价值**：小说作者不会每次复制粘贴长文。

**建议 PR 拆分**：

- `feat: import txt novel file`
- `feat: normalize imported chapter text`
- `feat: add import error messages`

---

## P2：产品化能力

这些功能更像正式 SaaS，三天内不建议全做，但 Roadmap 里必须有。

### 1. 登录系统

**目标**：用户可以拥有自己的项目、模型配置和历史记录。

**建议能力**：

- 邮箱 / GitHub 登录。
- Session 管理。
- 用户级项目隔离。
- 用户级 API Key 或平台统一 Key。

**注意**：登录不是为了好看，是为了数据归属和项目管理。没有项目存储就先别做登录，否则只是装饰。

### 2. 管理端

**目标**：管理模型、用户、项目、调用成本和失败日志。

**建议模块**：

- 用户列表。
- 项目列表。
- 模型供应商配置。
- Prompt 模板管理。
- 调用日志。
- Token 消耗统计。
- Schema 校验失败统计。

**价值**：展示系统可运营，不只是个人玩具。

### 3. 数据库持久化

**目标**：保存项目、章节、角色、场景、生成记录。

**建议数据表**：

- `users`
- `projects`
- `novel_chapters`
- `script_versions`
- `model_configs`
- `generation_runs`
- `validation_errors`

**原则**：先保存完整 YAML 版本，再考虑把每个 scene 拆表。不要一上来过度建模。

### 4. 异步任务队列

**目标**：长小说转换不能阻塞 HTTP 请求。

**建议能力**：

- 提交转换任务。
- 后台分章处理。
- 页面轮询或 SSE 展示进度。
- 失败可重试。

**价值**：解决真实长文本转换问题。

### 5. Prompt 模板系统

**目标**：不同改编方向使用不同 Prompt。

**模板类型**：

- 短剧。
- 电影剧本。
- 网剧分集大纲。
- 舞台剧。
- 分镜脚本。

**注意**：模板必须和 Schema 绑定，否则 AI 输出会乱。

---

## P3：真正拉开差距的 AI 能力

这些是高级能力，适合写在 Roadmap，挑一两个做出来就能明显加分。

### 1. 角色一致性追踪

**目标**：跨章节追踪角色别名、关系、性格变化，避免前后不一致。

**输出**：

- 角色小传。
- 角色关系图。
- 角色目标 / 阻碍 / 转变。

### 2. 故事结构分析

**目标**：不仅转场景，还分析三幕式、起承转合、冲突强度。

**输出**：

- 故事节拍表。
- 关键冲突点。
- 高潮位置。
- 节奏问题提示。

### 3. 多版本生成对比

**目标**：同一章节生成多个改编版本，用户选择更好的。

**对比维度**：

- 台词更自然。
- 冲突更强。
- 节奏更快。
- 更贴近原文。

### 4. 导出更多格式

**目标**：不只导出 YAML。

**格式**：

- Markdown。
- Fountain。
- PDF。
- 分镜表格。
- 剧组拍摄清单。

### 5. 人机协作改编流程

**目标**：让作者每一步都能控制，而不是 AI 一次性黑盒输出。

**流程**：

```text
小说输入
↓
章节摘要确认
↓
角色表确认
↓
场景拆分确认
↓
剧本生成
↓
局部修订
↓
导出
```

这比“一键生成”更像真正的创作工具。

---

## 不应该优先做的东西

这些东西看起来高级，但现在做就是浪费时间。

- 多人实时协作：没有项目持久化前别碰。
- 复杂权限系统：没有管理端数据前别碰。
- 支付系统：比赛阶段没有意义。
- 模板市场：现在连模板质量都没验证。
- 过度数据库拆表：先保存 YAML 版本，别把结构搞死。
- 花哨动画：界面够清晰就行，不要掩盖核心能力不足。

---

## 推荐下一轮 PR 顺序

如果继续冲刺，建议按这个顺序做：

1. `feat: add model configuration panel`
2. `feat: add local project drafts`
3. `feat: add scene-level rewrite workflow`
4. `feat: add conversion quality score`
5. `feat: import txt novel files`
6. `feat: add auth and persisted projects`
7. `feat: add admin model management`

前五个适合比赛阶段补强。第六、第七个适合产品化阶段。
