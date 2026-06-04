import { describe, expect, it } from "vitest";
import { POST } from "./route";

const validText = `第1章 雨夜来信
林夏在旧书店收到一封没有署名的信。

第2章 地铁尽头
林夏来到末班地铁。陈默出现。

第3章 天台对峙
林夏和陈默在天台对峙。`;

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/convert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/convert", () => {
  it("returns script YAML and report for valid input", async () => {
    const response = await POST(jsonRequest({ title: "雨夜来信", text: validText }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.yaml).toContain("metadata:");
    expect(body.report).toMatchObject({
      provider: "mock",
      chapterCount: 3,
      sceneCount: 3,
      validationPassed: true
    });
  });

  it("returns 400 when the novel has fewer than three chapters", async () => {
    const response = await POST(
      jsonRequest({
        title: "短篇",
        text: "第1章 开端\n只有一章。"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("至少需要 3 个章节，当前只有 1 个章节");
  });
});
