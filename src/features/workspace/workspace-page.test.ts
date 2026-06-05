import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { WorkspacePage } from "./workspace-page";
import { WorkspaceProvider } from "./workspace-context";

function renderWorkspacePageWithNodeEnv(nodeEnv: "development" | "production" | "test"): string {
  const originalNodeEnv = process.env.NODE_ENV;
  vi.stubEnv("NODE_ENV", nodeEnv);

  try {
    return renderToStaticMarkup(createElement(WorkspaceProvider, null, createElement(WorkspacePage)));
  } finally {
    vi.stubEnv("NODE_ENV", originalNodeEnv);
  }
}

describe("WorkspacePage model configuration", () => {
  test("shows development-only request model fields outside production", () => {
    const markup = renderWorkspacePageWithNodeEnv("development");

    expect(markup).toContain("API Key（仅本次请求）");
    expect(markup).toContain(">Base URL<");
    expect(markup).toContain("获取模型");
  });

  test("hides browser credential and endpoint override fields in production", () => {
    const markup = renderWorkspacePageWithNodeEnv("production");

    expect(markup).toContain("使用服务端 AI 配置");
    expect(markup).not.toContain("API Key（仅本次请求）");
    expect(markup).not.toContain(">Base URL<");
    expect(markup).not.toContain("获取模型");
  });
});
