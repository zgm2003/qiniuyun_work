export type WorkbenchRoute = "/workspace" | "/script" | "/projects" | "/drafts" | "/report";

export type WorkbenchNavItem = {
  href: WorkbenchRoute;
  label: string;
  description: string;
};

export const WORKBENCH_NAV_ITEMS: WorkbenchNavItem[] = [
  { href: "/workspace", label: "工作台", description: "小说输入、模型配置、章节大纲" },
  { href: "/script", label: "剧本审查", description: "YAML 编辑、Schema 校验、质量清单" },
  { href: "/projects", label: "服务端项目", description: "登录后保存、加载自己的小说改编项目" },
  { href: "/drafts", label: "项目草稿", description: "本地草稿保存、加载、删除" },
  { href: "/report", label: "质量报告", description: "章节、角色、场景、台词总结" }
];

export function getActiveWorkbenchRoute(pathname: string): WorkbenchRoute {
  const matched = WORKBENCH_NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matched?.href ?? "/workspace";
}
