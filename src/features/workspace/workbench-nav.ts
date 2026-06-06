export type WorkbenchRoute = "/workspace" | "/script" | "/projects" | "/drafts" | "/report";

export type WorkbenchNavItem = {
  href: WorkbenchRoute;
  label: string;
  description: string;
};

export const WORKBENCH_NAV_ITEMS: WorkbenchNavItem[] = [
  { href: "/workspace", label: "工作台", description: "小说输入、章节预览、一键生成" },
  { href: "/script", label: "编辑 YAML", description: "Schema 校验、质量清单、导出" }
];

const WORKBENCH_ROUTE_ROOTS: WorkbenchRoute[] = ["/workspace", "/script", "/projects", "/drafts", "/report"];

export function getActiveWorkbenchRoute(pathname: string): WorkbenchRoute {
  const matched = WORKBENCH_ROUTE_ROOTS.find((href) => pathname === href || pathname.startsWith(`${href}/`));
  return matched ?? "/workspace";
}
