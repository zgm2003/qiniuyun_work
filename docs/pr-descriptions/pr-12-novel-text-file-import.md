# PR 12: feat: add novel text file import

## 标题

feat: add novel text file import

## 功能描述

新增浏览器本地小说文本导入能力。用户可以选择 `.txt` 或 `.md` 文件导入小说正文，系统会用文件名生成标题，并刷新章节大纲预览。

## 实现思路

- 新增 `src/lib/file-import.ts`，负责校验文件名、扩展名、文件大小和文本内容，并从文件名推导标题。
- 页面使用浏览器 File API 的 `file.text()` 读取本地文件，不上传服务器。
- 导入成功后替换标题和小说正文，清空旧 YAML、转换报告、错误状态，并解除当前草稿绑定，避免误覆盖旧草稿。
- 支持 `.txt` / `.md`，限制 512KB；不支持 Word、PDF 或服务端上传。
- 不修改 `/api/convert`、AI provider、YAML Schema、导出逻辑或草稿存储结构。

## 测试方式

```bash
npm test
npm run lint
npm run build
```

手工验证：

1. 启动 `npm run dev`。
2. 点击“导入文本”。
3. 选择 `samples/novel-3chapters.txt`。
4. 确认标题按文件名生成，小说正文被替换。
5. 确认章节大纲预览识别出 3 章。
6. 尝试选择非 `.txt` / `.md` 文件，确认页面显示错误且不覆盖当前编辑区。

## 第三方依赖

未新增第三方依赖。继续使用浏览器 File API 和项目已有的 Next.js、React、Vitest、Zod、yaml。

## 原创功能说明

本 PR 的文件导入校验、文件名标题推导、页面交互和测试均为本项目新增实现。
