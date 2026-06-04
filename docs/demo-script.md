# 录屏演示脚本

## 准备

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 演示主线

1. 展示首页标题和 Provider 卡片，说明默认使用 `mock`，无 API Key 也能稳定演示。
2. 点击“加载样例”。
3. 指出页面识别出 3 个章节，满足题目要求。
4. 点击“转换为 YAML 剧本”。
5. 展示右侧 YAML：包含 `metadata`、`characters`、`scenes`、`summary`。
6. 展示底部转换总结：章节、角色、场景、台词数量。
7. 删除 YAML 中的 `metadata.title`。
8. 指出 Schema 校验失败，错误定位到 `metadata.title`。
9. 恢复 `metadata.title`。
10. 指出 Schema 校验通过，点击“导出 YAML”。
11. 打开 `docs/script-yaml-schema.md`，说明为什么这样设计 YAML Schema。

## 讲解重点

- 不是简单文本生成，而是输出可编辑、可校验的结构化剧本。
- 少于 3 个章节会直接拒绝，不生成假结果。
- 缺字段不使用空字符串兜底，避免掩盖 AI 输出错误。
- mock provider 保证现场稳定，OpenAI-compatible provider 保留真实 AI 能力。

## 失败演示

可以把小说正文改成：

```text
第1章 开端
只有一章。
```

点击转换后应看到：

```text
至少需要 3 个章节，当前只有 1 个章节
```
