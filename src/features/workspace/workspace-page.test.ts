import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ModelSettingsDialog } from "./model-settings-dialog";
import { ScriptPage } from "./script-page";
import { WorkspacePage } from "./workspace-page";
import { WorkspaceProvider } from "./workspace-context";

function renderWithWorkspaceProvider(nodeEnv: "development" | "production" | "test", element: ReturnType<typeof createElement>): string {
  const originalNodeEnv = process.env.NODE_ENV;
  vi.stubEnv("NODE_ENV", nodeEnv);

  try {
    return renderToStaticMarkup(createElement(WorkspaceProvider, null, element));
  } finally {
    vi.stubEnv("NODE_ENV", originalNodeEnv);
  }
}

describe("WorkspacePage model configuration", () => {
  test("keeps model configuration out of the initial workbench flow", () => {
    const markup = renderWithWorkspaceProvider("development", createElement(WorkspacePage));

    expect(markup).toContain("模型设置");
    expect(markup).toContain('aria-label="使用步骤"');
    expect(markup).not.toContain('<ol class="grid w-full');
    expect(markup).not.toContain('id="model-config"');
    expect(markup).not.toContain("API Key（仅本次请求）");
    expect(markup).not.toContain(">Base URL<");
    expect(markup).not.toContain("获取模型");
  });

  test("keeps the visible workbench focused on the novel-to-yaml path", () => {
    const markup = renderWithWorkspaceProvider("development", createElement(WorkspacePage));

    expect(markup).toContain("小说输入");
    expect(markup).toContain("生成准备");
    expect(markup).toContain("章节大纲预览");
    expect(markup).toContain("生成 YAML 剧本");
    expect(markup).toContain("编辑导出");
    expect(markup).not.toContain("服务端项目");
    expect(markup).not.toContain("项目草稿");
    expect(markup).not.toContain("质量报告");
  });

  test("opens development-only request model fields inside the settings dialog", () => {
    const markup = renderWithWorkspaceProvider("development", createElement(ModelSettingsDialog, { defaultOpen: true }));

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("API Key（仅本次请求）");
    expect(markup).toContain(">Base URL<");
    expect(markup).toContain("获取模型");
  });

  test("opens production settings as a server-config explanation without browser credentials", () => {
    const markup = renderWithWorkspaceProvider("production", createElement(ModelSettingsDialog, { defaultOpen: true }));

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("使用服务端 AI 配置");
    expect(markup).not.toContain("API Key（仅本次请求）");
    expect(markup).not.toContain(">Base URL<");
    expect(markup).not.toContain("获取模型");
  });
});

describe("ScriptPage flow", () => {
  test("points authors back to generation before yaml exists", () => {
    const markup = renderWithWorkspaceProvider("development", createElement(ScriptPage));

    expect(markup).toContain("编辑 YAML 剧本");
    expect(markup).toContain("还没有 YAML 剧本");
    expect(markup).toContain("去生成 YAML");
    expect(markup).toContain("导出 YAML");
    expect(markup).not.toContain("故意删除");
  });
});
