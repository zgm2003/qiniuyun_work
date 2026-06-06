import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { convertNovelWithProvider } from "@/lib/ai-provider";
import { createScriptVersion, getProject, recordGenerationRun } from "@/lib/server/projects";

vi.mock("@/lib/ai-provider", () => ({
  convertNovelWithProvider: vi.fn()
}));

vi.mock("@/lib/server/projects", () => ({
  createScriptVersion: vi.fn(),
  getProject: vi.fn(),
  recordGenerationRun: vi.fn()
}));

const convertNovelWithProviderMock = vi.mocked(convertNovelWithProvider);
const createScriptVersionMock = vi.mocked(createScriptVersion);
const getProjectMock = vi.mocked(getProject);
const recordGenerationRunMock = vi.mocked(recordGenerationRun);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/convert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

const validText = `第1章 雨夜来信
林夏在旧书店收到一封没有署名的信。

第2章 地铁尽头
林夏来到末班地铁。陈默出现。

第3章 天台对峙
林夏和陈默在天台对峙。`;

const report = {
  provider: "openai-compatible" as const,
  chapterCount: 3,
  characterCount: 2,
  sceneCount: 3,
  dialogueLineCount: 3,
  validationPassed: true
};

describe("POST /api/convert persistence", () => {
  beforeEach(() => {
    convertNovelWithProviderMock.mockReset();
    createScriptVersionMock.mockReset();
    getProjectMock.mockReset();
    recordGenerationRunMock.mockReset();
    getProjectMock.mockResolvedValue({
      id: "project-1",
      title: "雨夜来信",
      sourceText: validText,
      status: "draft",
      latestVersion: null,
      createdAt: "2026-06-06T01:00:00.000Z",
      updatedAt: "2026-06-06T01:00:00.000Z"
    });
  });

  it("saves a bound project script version and succeeded generation run after conversion", async () => {
    convertNovelWithProviderMock.mockResolvedValue({ yaml: "metadata:\n  title: 雨夜来信\n", report });

    const response = await POST(
      jsonRequest({
        projectId: "project-1",
        title: "雨夜来信",
        text: validText,
        modelConfig: {
          provider: "openai-compatible",
          apiKey: "request-key",
          baseUrl: "https://request.example.test/v1",
          model: "gpt-5.4",
          temperature: 0.4
        }
      })
    );

    expect(response.status).toBe(200);
    expect(getProjectMock).toHaveBeenCalledWith("project-1");
    expect(createScriptVersionMock).toHaveBeenCalledWith({
      projectId: "project-1",
      yaml: "metadata:\n  title: 雨夜来信\n",
      report
    });
    expect(recordGenerationRunMock).toHaveBeenCalledWith({
      projectId: "project-1",
      provider: "openai-compatible",
      model: "gpt-5.4",
      status: "succeeded",
      errorMessage: null
    });
  });

  it("records a failed generation run when bound project conversion fails", async () => {
    convertNovelWithProviderMock.mockRejectedValue(new Error("AI 服务请求失败：500"));

    const response = await POST(
      jsonRequest({
        projectId: "project-1",
        title: "雨夜来信",
        text: validText,
        modelConfig: {
          provider: "openai-compatible",
          model: "gpt-5.4",
          temperature: 0.4
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("AI 服务请求失败：500");
    expect(createScriptVersionMock).not.toHaveBeenCalled();
    expect(recordGenerationRunMock).toHaveBeenCalledWith({
      projectId: "project-1",
      provider: "openai-compatible",
      model: "gpt-5.4",
      status: "failed",
      errorMessage: "AI 服务请求失败：500"
    });
  });

  it("does not convert when the bound project is missing", async () => {
    getProjectMock.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({
        projectId: "missing-project",
        title: "雨夜来信",
        text: validText
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("项目不存在");
    expect(convertNovelWithProviderMock).not.toHaveBeenCalled();
    expect(createScriptVersionMock).not.toHaveBeenCalled();
    expect(recordGenerationRunMock).not.toHaveBeenCalled();
  });
});
