import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { createProject, listProjects } from "@/lib/server/projects";

vi.mock("@/lib/server/projects", () => ({
  createProject: vi.fn(),
  listProjects: vi.fn()
}));

const createProjectMock = vi.mocked(createProject);
const listProjectsMock = vi.mocked(listProjects);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("/api/projects", () => {
  beforeEach(() => {
    createProjectMock.mockReset();
    listProjectsMock.mockReset();
  });

  it("returns all server project drafts", async () => {
    listProjectsMock.mockResolvedValue([
      {
        id: "project-1",
        title: "雨夜来信",
        status: "generated",
        createdAt: "2026-06-05T01:00:00.000Z",
        updatedAt: "2026-06-05T02:00:00.000Z",
        latestGenerationRun: {
          id: "run-1",
          projectId: "project-1",
          provider: "openai-compatible",
          model: "cheap-model",
          status: "succeeded",
          errorMessage: null,
          createdAt: "2026-06-05T02:10:00.000Z"
        }
      }
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].latestGenerationRun).toEqual({
      id: "run-1",
      projectId: "project-1",
      provider: "openai-compatible",
      model: "cheap-model",
      status: "succeeded",
      errorMessage: null,
      createdAt: "2026-06-05T02:10:00.000Z"
    });
    expect(listProjectsMock).toHaveBeenCalledWith();
  });

  it("creates a project draft", async () => {
    createProjectMock.mockResolvedValue({
      id: "project-1",
      title: "雨夜来信",
      sourceText: "第1章 A\n正文",
      status: "draft",
      createdAt: "2026-06-05T01:00:00.000Z",
      updatedAt: "2026-06-05T01:00:00.000Z"
    });

    const response = await POST(
      jsonRequest({
        title: " 雨夜来信 ",
        sourceText: "第1章 A\n正文"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.project).toMatchObject({ id: "project-1", title: "雨夜来信" });
    expect(createProjectMock).toHaveBeenCalledWith({
      title: " 雨夜来信 ",
      sourceText: "第1章 A\n正文"
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad json"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("请求体必须是 JSON");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("returns 400 for blank titles", async () => {
    const response = await POST(jsonRequest({ title: "   ", sourceText: "正文" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("标题不能为空");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("returns 400 for blank source text", async () => {
    const response = await POST(jsonRequest({ title: "雨夜来信", sourceText: "   " }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("小说正文不能为空");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("returns 500 when persistence fails", async () => {
    createProjectMock.mockRejectedValue(new Error("database down"));

    const response = await POST(jsonRequest({ title: "雨夜来信", sourceText: "正文" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("项目保存失败");
  });
});
