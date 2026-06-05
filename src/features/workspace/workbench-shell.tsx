"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { fetchCurrentUser, logout, type UserSummary } from "@/features/auth/auth-client";
import { getActiveWorkbenchRoute, WORKBENCH_NAV_ITEMS } from "./workbench-nav";
import { useWorkspace } from "./workspace-context";

export function WorkbenchShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeRoute = getActiveWorkbenchRoute(pathname);
  const { model } = useWorkspace();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let ignore = false;
    fetchCurrentUser()
      .then((currentUser) => {
        if (!ignore) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (!ignore) {
          setUser(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  function handleLogout() {
    startTransition(async () => {
      await logout();
      setUser(null);
    });
  }

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
          <div className="nav-account">
            <span className="nav-status">{user ? user.email : model}</span>
            {user ? (
              <button className="ghost-button nav-auth-button" type="button" disabled={isPending} onClick={handleLogout}>
                退出
              </button>
            ) : (
              <span className="nav-auth-links">
                <Link href="/login">登录</Link>
                <Link href="/register">注册</Link>
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="app-shell">{children}</main>
    </>
  );
}
