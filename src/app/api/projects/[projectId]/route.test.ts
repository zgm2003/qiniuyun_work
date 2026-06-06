import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProject, updateProject } from "@/lib/server/projects";
import { GET, PATCH } from "./route";

vi.mock("@/lib/server/projects", () => ({
  getProject: vi.fn(),
  updateProject: vi.fn()
}));

const getProjectMock = vi.mocked(getProject);
const updateProjectMock = vi.mocked(updateProject);

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
    getProjectMock.mockReset();
    updateProjectMock.mockReset();
  });

  it("loads a project draft", async () => {
    getProjectMock.mockResolvedValue({
      id: "project-1",
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
    expect(body.project).toMatchObject({ id: "project-1", title: "雨夜来信" });
    expect(getProjectMock).toHaveBeenCalledWith("project-1");
  });

  it("returns 404 when the project does not exist", async () => {
    getProjectMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1"), context());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("项目不存在");
  });

  it("updates a project draft", async () => {
    updateProjectMock.mockResolvedValue({
      id: "project-1",
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
    expect(updateProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      title: "新标题",
      sourceText: "新正文"
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/projects/project-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{bad json"
      }),
      context()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("请求体必须是 JSON");
    expect(updateProjectMock).not.toHaveBeenCalled();
  });
});
