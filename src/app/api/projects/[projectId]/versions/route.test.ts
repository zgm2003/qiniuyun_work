import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createScriptVersion } from "@/lib/server/projects";
import { convertNovelToScript } from "@/lib/mock-converter";

vi.mock("@/lib/server/projects", () => ({
  createScriptVersion: vi.fn()
}));

const createScriptVersionMock = vi.mocked(createScriptVersion);
const validNovel = `第1章 雨夜来信
林夏在旧书店收到一封没有署名的信。

第2章 地铁尽头
林夏来到末班地铁。陈默出现。

第3章 天台对峙
林夏和陈默在天台对峙。`;
const generated = convertNovelToScript({ title: "雨夜来信", text: validNovel });

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/projects/project-1/versions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function context(projectId = "project-1") {
  return { params: Promise.resolve({ projectId }) };
}

describe("POST /api/projects/[projectId]/versions", () => {
  beforeEach(() => {
    createScriptVersionMock.mockReset();
  });

  it("creates a script version", async () => {
    createScriptVersionMock.mockResolvedValue({
      id: "version-1",
      projectId: "project-1",
      yaml: generated.yaml,
      report: generated.report,
      validation: { ok: true, document: expect.any(Object) },
      createdAt: "2026-06-05T01:00:00.000Z"
    });

    const response = await POST(jsonRequest({ yaml: generated.yaml, report: generated.report }), context());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.version).toMatchObject({ id: "version-1", projectId: "project-1" });
    expect(createScriptVersionMock).toHaveBeenCalledWith({
      projectId: "project-1",
      yaml: generated.yaml,
      report: generated.report
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/projects/project-1/versions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad json"
      }),
      context()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("请求体必须是 JSON");
    expect(createScriptVersionMock).not.toHaveBeenCalled();
  });


  it("returns 400 for blank project ids", async () => {
    const response = await POST(jsonRequest({ yaml: generated.yaml, report: generated.report }), context("   "));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("projectId 不能为空");
    expect(createScriptVersionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid YAML", async () => {
    createScriptVersionMock.mockRejectedValue(new Error("YAML 未通过 Schema 校验：metadata.title: Invalid input"));

    const response = await POST(
      jsonRequest({
        yaml: "metadata:\n  title: 缺字段",
        report: generated.report
      }),
      context()
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("YAML 未通过 Schema 校验");
  });

  it("returns 500 when persistence fails", async () => {
    createScriptVersionMock.mockRejectedValue(new Error("database down"));

    const response = await POST(jsonRequest({ yaml: generated.yaml, report: generated.report }), context());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("剧本版本保存失败");
  });
});
