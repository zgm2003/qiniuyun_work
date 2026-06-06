import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServerProject,
  listServerProjects,
  loadServerProject,
  saveServerScriptVersion,
  updateServerProject
} from "./server-projects-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("server projects client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists and loads server project drafts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ projects: [{ id: "project-1", title: "雨夜来信", status: "draft", createdAt: "c", updatedAt: "u", latestGenerationRun: null }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          project: {
            id: "project-1",
            title: "雨夜来信",
            sourceText: "正文",
            status: "draft",
            createdAt: "c",
            updatedAt: "u",
            latestVersion: null
          }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listServerProjects()).resolves.toEqual([
      { id: "project-1", title: "雨夜来信", status: "draft", createdAt: "c", updatedAt: "u", latestGenerationRun: null }
    ]);
    await expect(loadServerProject("project-1")).resolves.toMatchObject({ id: "project-1", sourceText: "正文" });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/projects", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/projects/project-1", { cache: "no-store" });
  });

  it("creates, updates, and saves versions without sending model credentials", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ project: { id: "project-1", title: "雨夜来信", sourceText: "正文", status: "draft", createdAt: "c", updatedAt: "u", latestVersion: null } })
    );
    vi.stubGlobal("fetch", fetchMock);

    await createServerProject("雨夜来信", "正文");
    await updateServerProject("project-1", "雨夜来信 2", "正文 2");
    await saveServerScriptVersion("project-1", "metadata:\n  title: 雨夜来信", {
      provider: "openai-compatible",
      chapterCount: 3,
      characterCount: 1,
      sceneCount: 1,
      dialogueLineCount: 1,
      validationPassed: true
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "雨夜来信", sourceText: "正文" })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/projects/project-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "雨夜来信 2", sourceText: "正文 2" })
    });
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain("apiKey");
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain("baseUrl");
  });

  it("throws server error messages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "项目不存在" }, 404)));

    await expect(listServerProjects()).rejects.toThrow("项目不存在");
  });
});
