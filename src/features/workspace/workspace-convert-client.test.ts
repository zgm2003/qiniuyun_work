import { describe, expect, test, vi } from "vitest";
import { convertWorkspaceOnServer } from "./workspace-convert-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("workspace convert client", () => {
  test("sends the bound project id so conversion output and run records can be persisted", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        yaml: "metadata:\n  title: 雨夜来信\n",
        report: {
          provider: "mock",
          chapterCount: 3,
          characterCount: 1,
          sceneCount: 3,
          dialogueLineCount: 3,
          validationPassed: true
        }
      })
    );

    await convertWorkspaceOnServer(
      {
        projectId: "project-1",
        title: "雨夜来信",
        text: "第1章 A\n正文\n\n第2章 B\n正文\n\n第3章 C\n正文",
        modelConfig: { provider: "mock" }
      },
      fetchImpl
    );

    expect(fetchImpl).toHaveBeenCalledWith("/api/convert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        title: "雨夜来信",
        text: "第1章 A\n正文\n\n第2章 B\n正文\n\n第3章 C\n正文",
        modelConfig: { provider: "mock" }
      })
    });
  });

  test("throws API errors without inventing fallback conversion output", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "AI 服务请求失败：500" }, 400));

    await expect(
      convertWorkspaceOnServer(
        {
          projectId: "project-1",
          title: "雨夜来信",
          text: "第1章 A\n正文\n\n第2章 B\n正文\n\n第3章 C\n正文",
          modelConfig: { provider: "openai-compatible", model: "gpt-5.4" }
        },
        fetchImpl
      )
    ).rejects.toThrow("AI 服务请求失败：500");
  });
});
