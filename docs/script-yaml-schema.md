# 剧本 YAML Schema v1.0 说明

这份文档用于题目三验收：解释“小说文本转换为结构化剧本（YAML 格式）”时，YAML 应该长什么样，以及为什么这样设计。

## 设计目标

这个 Schema 只解决一个真实问题：让小说作者快速拿到可编辑、可校验、可继续打磨的剧本初稿。

它不追求覆盖所有影视工业格式，也不做复杂制片管理。当前 MVP 需要稳定表达四类数据：

1. 原作品来源信息。
2. 角色表。
3. 按场景拆分的剧本正文。
4. 改编摘要和后续打磨建议。

## 为什么使用 YAML

YAML 适合长文本、台词和人工编辑。作者可以直接改台词、动作和镜头提示；程序也能解析 YAML，再用 Schema 校验结构是否完整。

这里不用纯自然语言输出，原因很简单：自然语言看起来顺滑，但很难判断是否漏了角色、场景、台词或章节来源。YAML 能把“AI 写得像不像”和“结构是否交付完整”分开检查。

## 顶层结构

顶层固定四个字段，不接受额外顶层字段：

```yaml
metadata:
  title: 雨夜来信
  source_chapters: 5
  language: zh-CN
  format_version: "1.0"
characters:
  - id: char_001
    name: 林夏
    role: protagonist
    traits:
      - 谨慎
      - 执着
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
    camera_notes: 推镜到信封上的黑蜡印。
summary:
  logline: 一个女孩追查匿名信背后的十年前剧院大火真相。
  themes:
    - 真相
    - 选择
  adaptation_notes:
    - 保留悬疑节奏，减少解释性旁白。
```

## 字段定义

### metadata

| 字段 | 类型 | 规则 | 设计原因 |
| --- | --- | --- | --- |
| `title` | string | 必填，非空 | 作者需要明确当前剧本属于哪部作品。 |
| `source_chapters` | integer | 必填，最小值 3 | 这是题目硬约束，必须进入结构本身，不能只靠页面提示。 |
| `language` | string | 必填，非空 | 为后续多语言提示词、导出和审阅保留稳定入口。 |
| `format_version` | string | 必填，当前版本为 `"1.0"` | 版本字段用于兼容旧 YAML，后续升级不能破坏已有文档。 |

`metadata` 的设计重点是可追溯。作者拿到 YAML 后，要能知道它来自几章小说、输出语言是什么、使用哪个结构版本。

### characters

`characters` 是角色表，每个角色对象包含：

| 字段 | 类型 | 规则 | 设计原因 |
| --- | --- | --- | --- |
| `id` | string | 必填，非空，例如 `char_001` | 场景和台词引用稳定 ID，避免同名、别名、改名造成混乱。 |
| `name` | string | 必填，非空 | 给作者看的角色名。 |
| `role` | enum | `protagonist` / `antagonist` / `supporting` / `narrator` / `other` | 用枚举限制角色功能，避免 AI 随意发明字段语义。 |
| `traits` | string[] | 至少 1 项，每项非空 | 给二次打磨提供角色性格方向。 |

这里没有做复杂人物小传。MVP 的重点是“可用于剧本改编”，不是角色档案管理系统。

### scenes

`scenes` 是剧本正文的核心。小说按章节输入，但剧本必须按场景组织。

| 字段 | 类型 | 规则 | 设计原因 |
| --- | --- | --- | --- |
| `id` | string | 必填，非空，例如 `scene_001` | 方便编辑器定位、导出和后续局部重写。 |
| `chapter` | integer | 必填，最小值 1 | 保留该场景来自哪一章，便于作者回看原文。 |
| `heading` | string | 必填，非空 | 场景标题，方便快速浏览。 |
| `location` | string | 必填，非空 | 剧本需要明确空间。 |
| `time` | string | 必填，非空 | 剧本需要明确时间段或氛围。 |
| `characters` | string[] | 至少 1 项 | 列出出场角色 ID，方便后续做角色出场统计。 |
| `action` | string | 必填，非空 | 承接小说叙事，转成可拍、可演的动作描述。 |
| `dialogue` | Dialogue[] | 至少 1 条 | 剧本初稿必须包含可编辑对白。 |
| `camera_notes` | string | 必填，非空 | 给短剧、分镜或舞台调度提供初始提示。 |

设计原因：剧本的最小工作单元是场景，不是小说章节。`chapter` 只负责追溯来源，真正供作者编辑的是 `scenes`。

### dialogue

每条台词包含：

| 字段 | 类型 | 规则 | 设计原因 |
| --- | --- | --- | --- |
| `character` | string | 必填，非空，建议引用 `characters.id` | 用角色 ID 绑定说话人，避免重名。 |
| `line` | string | 必填，非空 | 台词正文。 |
| `emotion` | string | 必填，非空 | 口吻、情绪和表演提示，不混入台词正文。 |

`emotion` 独立出来是为了让作者能只改情绪，不必重写台词；也避免二次生成时把“愤怒地说”污染进对白文本。

### summary

| 字段 | 类型 | 规则 | 设计原因 |
| --- | --- | --- | --- |
| `logline` | string | 必填，非空 | 一句话判断 AI 是否抓住主线。 |
| `themes` | string[] | 至少 1 项 | 提炼主题，帮助作者判断改编方向。 |
| `adaptation_notes` | string[] | 至少 1 项 | 说明 AI 做了哪些改编取舍，方便继续打磨。 |

`summary` 不是装饰字段。它让评审和作者能快速判断：这个 YAML 不是机械拆句，而是真的形成了一个可继续编辑的剧本初稿。

## 校验规则

运行时校验遵循这些原则：

- 顶层必须包含 `metadata`、`characters`、`scenes`、`summary`。
- 必填字段缺失直接失败。
- 字符串字段不能为空。
- `metadata.source_chapters` 必须大于等于 3。
- `characters`、`scenes`、`dialogue`、`themes`、`adaptation_notes` 至少包含 1 项。
- 对象使用严格结构，未知字段不静默吞掉。
- YAML 解析失败时，直接报告错误，不导出坏文件。

本项目不使用空字符串、空数组或默认对象去兜底缺失字段。字段缺失通常表示 AI 输出损坏、提示词失败或数据流错误。兜底只会制造“看似完整、实际不可用”的剧本。

## Structured Outputs 对应关系

产品生成链路使用同一份剧本文档结构：

```text
OpenAI-compatible Structured Outputs JSON
↓
ScriptDocument Schema 校验
↓
转换为 YAML
↓
页面内 YAML 编辑与二次校验
↓
导出 .yaml
```

这样做的原因是避免出现两套剧本结构：一套给 AI，一套给页面。数据结构只有一份，错误也只需要在一个地方被发现。

## 质量清单与 Schema 的边界

Schema 负责判断“结构是否完整”；质量清单负责把结构结果翻译成作者和评审能看懂的检查项，例如：

- YAML Schema 是否通过。
- metadata 是否完整。
- 角色是否有稳定 ID 和 traits。
- 场景是否包含地点、时间、动作和镜头提示。
- 每个场景是否包含台词。
- 台词角色引用是否有效。
- summary 是否可交付。

这不是 AI 剧情评分，也不是文学评价。它只做交付检查：这个结果能不能作为作者继续打磨的初稿。

## 版本策略

当前 Schema 版本为 `1.0`。

后续升级遵循两个原则：

1. 不改变已有字段语义。
2. 新能力优先新增可选字段，必要时引入新版本 Schema。

兼容性优先。旧 YAML 能继续读取，比“看起来更优雅的新结构”更重要。
