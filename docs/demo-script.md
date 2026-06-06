# 录屏演示脚本

## 准备

```bash
npm install
npm run dev
```

打开 `http://localhost:3001`。

## 演示主线

1. 展示首页和多路由导航，说明产品界面只面向真实 OpenAI-compatible 能力。
2. 点击“导入文本”，选择 `samples/novel-3chapters.txt`；如果现场不方便选文件，可以点击“加载样例”恢复同一类输入。
3. 指出标题由文件名生成，且“章节大纲预览”识别出 3 个章节，显示每章标题、字数和正文预览。
4. 展示“模型配置”面板：只维护一套 OpenAI-compatible AI 配置，可临时获取模型列表挑选更便宜的 model。
5. 本地开发录屏可填写 base URL 和 API Key，点击“获取模型”选择 model，再设置 temperature；生产录屏使用服务端 AI 配置，不展示也不填写浏览器侧 API Key/Base URL/model。
6. 点击“转换为 YAML 剧本”。
7. 切到“剧本审查”，展示 YAML 包含 `metadata`、`characters`、`scenes`、`summary`。
8. 展示“剧本质量清单”：Schema、元信息、角色、场景、台词、引用、总结全部通过。
9. 切到“质量报告”，展示章节、角色、场景、台词数量。
10. 点击“保存为新草稿”，说明草稿只保存在当前浏览器。
11. 刷新页面，展示草稿列表仍然存在。
12. 点击“加载”，恢复标题、小说正文、YAML 和转换报告。
13. 点击“删除”，说明删除草稿不会清空当前编辑区。
14. 删除 YAML 中的 `metadata.title`。
15. 指出 Schema 校验失败，错误定位到 `metadata.title`，质量清单也显示对应失败项。
16. 恢复 `metadata.title`。
17. 指出 Schema 校验通过，点击“导出 YAML”。
18. 打开 `docs/script-yaml-schema.md`，说明为什么这样设计 YAML Schema。

## 讲解重点

- 不是简单文本生成，而是输出可编辑、可校验的结构化剧本。
- 文本导入只在浏览器本地读取 `.txt` / `.md`，不上传服务器。
- 章节大纲预览先暴露解析结果，避免用户不知道系统到底读懂了哪些章节。
- 剧本质量清单是结构交付检查，不是 AI 主观剧情评分。
- 少于 3 个章节会直接拒绝，不生成假结果。
- 缺字段不使用空字符串兜底，避免掩盖 AI 输出错误。
- 产品界面只暴露真实 OpenAI-compatible 能力；确定性转换器只保留给测试、CI 和样例输出。
- 模型配置是唯一 AI 配置，API Key 加密入库；临时模型列表不入库，不保存到仓库，也不写入 localStorage。
- 本地草稿保存的是作品状态，不保存 API Key、Base URL、model、provider 或 temperature。

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
