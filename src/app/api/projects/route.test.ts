import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createProject } from "@/lib/server/projects";

vi.mock("@/lib/server/projects", () => ({
  createProject: vi.fn()
}));

const createProjectMock = vi.mocked(createProject);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/projects", () => {
  beforeEach(() => {
    createProjectMock.mockReset();
  });

  it("creates a project", async () => {
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
