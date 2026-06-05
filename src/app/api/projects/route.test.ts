import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { createProject, listProjectsForUser } from "@/lib/server/projects";
import { readCurrentUser } from "@/app/api/_auth";

vi.mock("@/lib/server/projects", () => ({
  createProject: vi.fn(),
  listProjectsForUser: vi.fn()
}));

vi.mock("@/app/api/_auth", () => ({
  readCurrentUser: vi.fn()
}));

const createProjectMock = vi.mocked(createProject);
const listProjectsForUserMock = vi.mocked(listProjectsForUser);
const readCurrentUserMock = vi.mocked(readCurrentUser);

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
    listProjectsForUserMock.mockReset();
    readCurrentUserMock.mockReset();
    readCurrentUserMock.mockResolvedValue(null);
  });

  it("returns current user's projects", async () => {
    readCurrentUserMock.mockResolvedValue({ id: "user-1", email: "author@example.com", name: "作者" });
    listProjectsForUserMock.mockResolvedValue([
      {
        id: "project-1",
        title: "雨夜来信",
        status: "generated",
        createdAt: "2026-06-05T01:00:00.000Z",
        updatedAt: "2026-06-05T02:00:00.000Z"
      }
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projects).toHaveLength(1);
    expect(listProjectsForUserMock).toHaveBeenCalledWith("user-1");
  });

  it("requires login before listing projects", async () => {
    readCurrentUserMock.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("请先登录");
    expect(listProjectsForUserMock).not.toHaveBeenCalled();
  });

  it("creates a project", async () => {
    createProjectMock.mockResolvedValue({
      id: "project-1",
      ownerUserId: null,
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
      sourceText: "第1章 A\n正文",
      ownerUserId: null
    });
  });

  it("binds created projects to the logged-in user", async () => {
    readCurrentUserMock.mockResolvedValue({ id: "user-1", email: "author@example.com", name: "作者" });
    createProjectMock.mockResolvedValue({
      id: "project-1",
      ownerUserId: "user-1",
      title: "雨夜来信",
      sourceText: "第1章 A\n正文",
      status: "draft",
      createdAt: "2026-06-05T01:00:00.000Z",
      updatedAt: "2026-06-05T01:00:00.000Z"
    });

    const response = await POST(jsonRequest({ title: "雨夜来信", sourceText: "第1章 A\n正文" }));

    expect(response.status).toBe(201);
    expect(createProjectMock).toHaveBeenCalledWith({
      title: "雨夜来信",
      sourceText: "第1章 A\n正文",
      ownerUserId: "user-1"
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
