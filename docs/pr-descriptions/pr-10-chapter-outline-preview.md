# PR 10: feat: add chapter outline preview

## 标题

feat: add chapter outline preview

## 功能描述

新增章节大纲预览。用户在转换前可以看到系统识别到的章节标题、每章正文字数和正文预览；当章节不足 3 章时，页面明确提示还差几章。

## 实现思路

- 新增 `src/lib/chapter-outline.ts`，把 `NovelChapter[]` 转成 UI 可直接渲染的大纲数据。
- 大纲构建逻辑保持纯函数，不依赖 React、DOM、localStorage 或 AI 服务。
- 首页在小说输入框下方展示“章节大纲预览”卡片。
- 转换按钮继续复用章节数量要求，不修改 `/api/convert`、AI provider 或 YAML Schema。

## 测试方式

```bash
npm test
npm run lint
npm run build
```

手工验证：

1. 启动 `npm run dev`。
2. 加载样例小说。
3. 确认“章节大纲预览”显示 3 章、每章标题、字数和正文预览。
4. 删除两章内容，只保留 1 章。
5. 确认页面提示还差 2 章，转换按钮不可用。

## 第三方依赖

未新增第三方依赖。继续使用项目已有的 Next.js、React、Vitest、Zod、yaml。

## 原创功能说明

本 PR 的章节大纲数据结构、摘要截断逻辑、页面展示和测试均为本项目新增实现。
