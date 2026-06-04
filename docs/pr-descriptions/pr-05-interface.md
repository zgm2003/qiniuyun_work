# PR 05 转换界面

## 标题

构建小说输入、YAML 编辑、Schema 校验和导出界面

## 功能描述

用户可以加载样例、转换剧本、编辑 YAML、查看校验结果并导出 YAML。

## 实现思路

前端只做交互编排，业务规则仍在 `src/lib` 和 API route 中。页面保留可录屏的失败路径。

## 测试方式

- `npm test`
- `npm run lint`
- `npm run build`
- 手动点击加载样例、转换、校验失败、恢复、导出
