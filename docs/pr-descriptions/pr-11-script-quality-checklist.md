# PR 11: feat: add script quality checklist

## 标题

feat: add script quality checklist

## 功能描述

新增剧本质量清单，把 YAML Schema 校验和结构交付检查转成用户可读的 checklist。用户可以看到当前剧本是否满足导出前的关键结构要求，例如元信息、角色 traits、场景台词、台词角色引用和 summary。

## 实现思路

- 新增 `src/lib/script-quality.ts`，根据 `ScriptValidationResult | null` 生成 UI 可直接渲染的质量清单。
- 清单逻辑保持纯函数，不依赖 React、DOM、localStorage 或 AI 服务。
- Schema 未通过时，只根据错误路径定位失败项；跨字段引用检查只在 Schema 通过后执行。
- 首页在 YAML Schema 校验结果下方展示“剧本质量清单”。
- 不修改 `/api/convert`、AI provider、YAML Schema、导出条件或草稿逻辑。

## 测试方式

```bash
npm test
npm run lint
npm run build
```

手工验证：

1. 启动 `npm run dev`。
2. 点击“转换为 YAML 剧本”。
3. 确认“剧本质量清单”显示全部通过。
4. 删除 YAML 中的 `metadata.title`。
5. 确认 Schema 校验失败，质量清单显示元信息相关失败项。
6. 恢复字段后确认质量清单重新通过。

## 第三方依赖

未新增第三方依赖。继续使用项目已有的 Next.js、React、Vitest、Zod、yaml。

## 原创功能说明

本 PR 的剧本质量清单数据结构、结构检查逻辑、页面展示和测试均为本项目新增实现。该功能是结构交付检查，不是 AI 主观剧情评分。
