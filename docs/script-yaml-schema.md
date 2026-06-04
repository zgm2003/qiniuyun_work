# 剧本 YAML Schema 说明

## 为什么使用 YAML

小说作者需要的是可编辑初稿，不是只能由程序读写的内部对象。YAML 比 JSON 更适合长文本、台词和人工修改；同时它仍然能被程序解析和 Schema 校验。

## 顶层结构

```yaml
metadata:
  title: 雨夜来信
  source_chapters: 3
  language: zh-CN
  format_version: "1.0"
characters:
  - id: char_001
    name: 林夏
    role: protagonist
    traits:
      - 谨慎
scenes:
  - id: scene_001
    chapter: 1
    heading: 雨夜来信
    location: 旧书店
    time: 雨夜
    characters:
      - char_001
    action: 林夏在旧书店收到一封没有署名的信。
    dialogue:
      - character: char_001
        line: 这是谁寄来的？
        emotion: 困惑
    camera_notes: 推镜到信封上的水痕。
summary:
  logline: 一个女孩追查匿名信背后的真相。
  themes:
    - 选择
  adaptation_notes:
    - 保留悬疑节奏，减少旁白。
```

## 字段定义

### metadata

- `title`：剧本标题，必填字符串。
- `source_chapters`：源小说章节数，必填整数，必须大于等于 3。
- `language`：输出语言，例如 `zh-CN`。
- `format_version`：Schema 版本，当前为 `1.0`。

设计原因：元信息用于追溯来源和版本。`source_chapters` 是题目硬约束，不能靠 UI 文案提醒，必须进入 Schema。

### characters

每个角色包含：

- `id`：稳定角色 ID，例如 `char_001`。
- `name`：角色名。
- `role`：角色功能，只允许 `protagonist`、`antagonist`、`supporting`、`narrator`、`other`。
- `traits`：角色特征，至少一个。

设计原因：场景里的角色引用使用 `id`，避免同名、别名或前后改名导致结构混乱。`role` 使用枚举，不让 AI 随意发明字段语义。

### scenes

每个场景包含：

- `id`：稳定场景 ID，例如 `scene_001`。
- `chapter`：来源章节编号。
- `heading`：场景标题。
- `location`：地点。
- `time`：时间。
- `characters`：出场角色 ID 列表，至少一个。
- `action`：场景动作描述。
- `dialogue`：台词列表，至少一条。
- `camera_notes`：镜头或舞台提示。

设计原因：剧本的核心不是章节，而是场景。`chapter` 保留来源映射，`scenes` 承担改编后的实际结构。动作、台词、镜头提示分开，方便作者后续编辑。

### dialogue

每条台词包含：

- `character`：说话角色 ID 或旁白标识。
- `line`：台词正文。
- `emotion`：表达状态。

设计原因：台词需要可单独编辑。`emotion` 是口吻提示，不混进台词正文，避免后续二次生成时污染对白。

### summary

- `logline`：一句话故事梗概。
- `themes`：主题列表。
- `adaptation_notes`：改编说明。

设计原因：评审和作者需要快速判断 AI 的改编方向是否正确。总结不是装饰，它是可量化反馈的一部分。

## 校验原则

本项目不对缺失字段做默认兜底。如果 `metadata.title`、`scenes[0].dialogue` 等字段缺失，校验必须失败。

原因很简单：字段缺失通常表示 AI 输出损坏、提示词失败或数据流错误。用空字符串兜底只会掩盖问题，让作者拿到看似完整、实际不可用的剧本。

## 版本策略

当前版本为 `1.0`。后续如果新增字段，只能新增可选字段或新版本 Schema，不应改变已有字段语义。兼容性优先，不能让旧 YAML 失效。
