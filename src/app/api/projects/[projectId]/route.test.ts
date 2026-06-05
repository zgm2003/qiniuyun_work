import { beforeEach, describe, expect, it, vi } from "vitest";
import { readCurrentUser } from "@/app/api/_auth";
import { getProjectForUser, updateProjectForUser } from "@/lib/server/projects";
import { GET, PATCH } from "./route";

vi.mock("@/app/api/_auth", () => ({
  readCurrentUser: vi.fn()
}));

vi.mock("@/lib/server/projects", () => ({
  getProjectForUser: vi.fn(),
  updateProjectForUser: vi.fn()
}));

const readCurrentUserMock = vi.mocked(readCurrentUser);
const getProjectForUserMock = vi.mocked(getProjectForUser);
const updateProjectForUserMock = vi.mocked(updateProjectForUser);

function context(projectId = "project-1") {
  return { params: Promise.resolve({ projectId }) };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/projects/project-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("/api/projects/[projectId]", () => {
  beforeEach(() => {
    readCurrentUserMock.mockReset();
    getProjectForUserMock.mockReset();
    updateProjectForUserMock.mockReset();
  });

  it("requires login before loading project detail", async () => {
    readCurrentUserMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1"), context());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("请先登录");
    expect(getProjectForUserMock).not.toHaveBeenCalled();
  });

  it("loads only the current user's project", async () => {
    readCurrentUserMock.mockResolvedValue({ id: "user-1", email: "author@example.com", name: "作者" });
    getProjectForUserMock.mockResolvedValue({
      id: "project-1",
      ownerUserId: "user-1",
      title: "雨夜来信",
      sourceText: "正文",
      status: "generated",
      createdAt: "2026-06-05T01:00:00.000Z",
      updatedAt: "2026-06-05T02:00:00.000Z",
      latestVersion: null
    });

    const response = await GET(new Request("http://localhost/api/projects/project-1"), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project).toMatchObject({ id: "project-1", ownerUserId: "user-1" });
    expect(getProjectForUserMock).toHaveBeenCalledWith("project-1", "user-1");
  });

  it("returns 404 for projects not owned by the current user", async () => {
    readCurrentUserMock.mockResolvedValue({ id: "user-2", email: "other@example.com", name: "其他作者" });
    getProjectForUserMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1"), context());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("项目不存在");
  });

  it("updates only the current user's project", async () => {
    readCurrentUserMock.mockResolvedValue({ id: "user-1", email: "author@example.com", name: "作者" });
    updateProjectForUserMock.mockResolvedValue({
      id: "project-1",
      ownerUserId: "user-1",
      title: "新标题",
      sourceText: "新正文",
      status: "draft",
      createdAt: "2026-06-05T01:00:00.000Z",
      updatedAt: "2026-06-05T02:00:00.000Z"
    });

    const response = await PATCH(jsonRequest({ title: "新标题", sourceText: "新正文" }), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project.title).toBe("新标题");
    expect(updateProjectForUserMock).toHaveBeenCalledWith({
      projectId: "project-1",
      ownerUserId: "user-1",
      title: "新标题",
      sourceText: "新正文"
    });
  });
});
