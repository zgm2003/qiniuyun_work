import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { recordGenerationRun } from "@/lib/server/projects";

vi.mock("@/lib/server/projects", () => ({
  recordGenerationRun: vi.fn()
}));

const recordGenerationRunMock = vi.mocked(recordGenerationRun);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/projects/project-1/generation-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function context(projectId = "project-1") {
  return { params: Promise.resolve({ projectId }) };
}

describe("POST /api/projects/[projectId]/generation-runs", () => {
  beforeEach(() => {
    recordGenerationRunMock.mockReset();
  });

  it("records a generation run", async () => {
    recordGenerationRunMock.mockResolvedValue({
      id: "run-1",
      projectId: "project-1",
      provider: "openai-compatible",
      model: "gpt-5.5",
      status: "succeeded",
      errorMessage: null,
      createdAt: "2026-06-05T01:00:00.000Z"
    });

    const response = await POST(
      jsonRequest({
        provider: "openai-compatible",
        model: "gpt-5.5",
        status: "succeeded",
        errorMessage: null
      }),
      context()
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.run).toMatchObject({ id: "run-1", projectId: "project-1", status: "succeeded" });
    expect(recordGenerationRunMock).toHaveBeenCalledWith({
      projectId: "project-1",
      provider: "openai-compatible",
      model: "gpt-5.5",
      status: "succeeded",
      errorMessage: null
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/projects/project-1/generation-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad json"
      }),
      context()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("请求体必须是 JSON");
    expect(recordGenerationRunMock).not.toHaveBeenCalled();
  });

  it("returns 400 for blank model", async () => {
    const response = await POST(
      jsonRequest({
        provider: "openai-compatible",
        model: "   ",
        status: "failed",
        errorMessage: "AI 服务请求失败：500"
      }),
      context()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("model 不能为空");
    expect(recordGenerationRunMock).not.toHaveBeenCalled();
  });

  it("returns 500 when persistence fails", async () => {
    recordGenerationRunMock.mockRejectedValue(new Error("database down"));

    const response = await POST(
      jsonRequest({
        provider: "openai-compatible",
        model: "gpt-5.5",
        status: "failed",
        errorMessage: "AI 服务请求失败：500"
      }),
      context()
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("生成记录保存失败");
  });
});
