# 样式与界面 Guideline

本项目后续界面风格参考 `E:\admin_go\canvas_front_next` 的中性 SaaS / 管理台方向，但不直接复制它的代码。目标是建立一套稳定的视觉规则，让后续人类或 AI 改动页面时不会风格漂移。

## 设计目标

界面应该像一个专业创作工作台，而不是一次性 Demo。

关键词：

```text
清爽
中性
高信息密度
可长期使用
管理端友好
浅色优先
暗色可扩展
```

当前深色羊皮纸、小说稿纸感的视觉方向只适合早期演示，不适合产品化管理台。

## 视觉基准

### 色彩

使用中性色作为主体：

```text
background        #ffffff
foreground        #171717
muted background  #f5f5f5
muted text        #737373
border            #e5e5e5
card              #ffffff
primary           #171717
danger            #dc2626
success           #16a34a
warning           #d97706
```

原则：

- 不使用大面积彩色渐变。
- 不使用紫蓝 AI 风默认渐变。
- 颜色服务于状态和层级，不服务于炫技。
- 品牌色可以后续添加，但不能覆盖中性基调。

### 字体

优先使用系统无衬线字体：

```css
font-family:
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  "Microsoft YaHei",
  sans-serif;
```

代码、YAML、日志使用等宽字体：

```css
font-family:
  "SFMono-Regular",
  Consolas,
  "Liberation Mono",
  Menlo,
  monospace;
```

原则：

- 不再使用正文衬线字体作为主字体。
- 标题可以强一点，但不要做海报风。
- YAML 编辑区必须用等宽字体。

### 圆角与阴影

```text
radius-sm   6px
radius-md   10px
radius-lg   14px
radius-xl   20px
shadow      少用，优先用 border 区分层级
```

原则：

- 卡片可以圆角，但不要过度胶囊化。
- 管理台组件优先边框，不依赖厚重阴影。

### 间距

使用 4px 基准：

```text
4 / 8 / 12 / 16 / 24 / 32 / 48
```

页面主内容：

```text
max-width: 1280px - 1480px
horizontal padding: 24px - 32px
section gap: 24px
card padding: 20px - 24px
```

## 页面骨架

产品化后统一使用工作台骨架：

```text
sticky top nav
↓
main content container
↓
页面标题区
↓
主操作区 + 侧栏状态区
```

顶部导航包含：

- 产品名
- 工作台入口
- 项目入口
- AI 设置入口

不要每个页面各自造 header。

## 组件规则

### Button

按钮分四类：

```text
primary     核心动作，例如“生成剧本”
secondary   普通动作，例如“保存草稿”
ghost       导航或轻量动作
danger      删除、禁用
```

规则：

- 一个区块里只能有一个 primary。
- danger 不和 primary 混用成同等视觉重量。
- loading 状态必须禁用重复提交。

### Card

卡片用于组织功能区，不用于装饰。

卡片结构：

```text
header: title + description + optional action
body: actual controls / content
footer: secondary metadata
```

不要把所有东西都塞进一个巨型卡片。

### Form

表单规则：

- label 永远可见，不只靠 placeholder。
- 敏感字段，例如 API Key，默认密码框显示。
- 编辑已有 API Key 时不回显明文，只显示 masked 状态。
- 保存前做明确校验，不能用静默默认值掩盖问题。

### Table / List

管理端资源列表优先使用表格：

- 唯一 AI 配置
- Prompt 模板
- 调用日志

作者工作台项目列表可以用卡片或列表。

## 状态表达

统一状态文案：

```text
未配置
已启用
已禁用
健康
异常
等待生成
生成中
已完成
失败
```

状态颜色：

```text
success: 健康、已完成、已启用
warning: 等待、部分通过
danger: 失败、异常、禁用风险
muted: 未配置、未知
```

不要用“看起来差不多”的多个词描述同一状态。

## AI 改动规则

后续让 AI 修改 UI 时，必须遵守：

1. 先复用现有布局和 class，不先造新风格。
2. 新增颜色前先检查本文档 token 是否够用。
3. 新增组件前先确认是否能用 Button / Card / Form / Table 组合。
4. 不允许引入随机渐变、emoji 堆叠、大面积玻璃拟态。
5. 不允许为了一个页面引入新的 UI 框架。
6. YAML、日志、错误信息必须保持可复制、可阅读。
7. 移动端至少保证主流程可用，不要求完整管理端体验。

## 当前页面改造方向

现有首页应从“宣传页 + 工具页混合”改成工作台：

```text
顶部导航
页面标题：小说转剧本工作台
左侧：小说输入、导入、章节大纲
右侧：模型配置、生成状态、质量清单
下方：YAML 编辑与导出
```

改造时必须保持现有功能：

- 示例填充。
- `.txt` / `.md` 导入。
- 章节大纲预览。
- AI 转换。
- YAML 校验。
- 质量清单。
- 本地草稿。
- 导出。

样式可以大改，行为不能断。

## 管理端视觉方向

管理端使用更高信息密度：

```text
左侧或顶部导航
资源列表
搜索筛选
新增 / 编辑弹窗或独立表单页
状态标签
行内操作
```

AI 配置页第一版字段：

```text
Base URL
Model
API Key
健康状态
最后更新时间
```

只允许保存一套配置，不做供应商下拉。可以临时获取模型列表，但列表不入库；保存时只保存当前选中的 model。

Prompt 模板页第一版字段：

```text
模板名称
使用场景
系统 Prompt
用户 Prompt 模板
Schema 版本
启用状态
最后更新时间
```

## 可接受的依赖策略

当前项目没有 Tailwind、Ant Design 或 shadcn。

第一阶段 UI 改造可以继续使用普通 CSS，先统一 token 和布局。是否引入 UI 框架应单独开 PR 决定。

判断标准：

- 如果只是重做当前工作台，普通 CSS 足够。
- 如果开始做大量管理端表格、弹窗、表单，再评估 Ant Design 或 shadcn。
- 不允许在同一个 PR 里同时引入 UI 框架、重构页面和接数据库。
