"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { getActiveWorkbenchRoute, WORKBENCH_NAV_ITEMS } from "./workbench-nav";
import { useWorkspace } from "./workspace-context";

export function WorkbenchShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeRoute = getActiveWorkbenchRoute(pathname);
  const { activeProviderText, model, provider } = useWorkspace();

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <Link className="brand-mark" href="/workspace" aria-label="AI 小说转剧本工作台首页">
            <span className="brand-icon">剧</span>
            <span>
              <strong>ScriptForge</strong>
              <small>AI 小说转剧本</small>
            </span>
          </Link>
          <nav aria-label="产品导航">
            {WORKBENCH_NAV_ITEMS.map((item) => (
              <Link className={item.href === activeRoute ? "active" : undefined} href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="nav-status">{provider === "mock" ? activeProviderText : model}</span>
        </div>
      </header>

      <main className="app-shell">{children}</main>
    </>
  );
}
