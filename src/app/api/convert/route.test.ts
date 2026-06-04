import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { convertNovelToScript } from "@/lib/mock-converter";

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

  it("accepts optional model config without breaking the old payload shape", async () => {
    const originalFetch = globalThis.fetch;
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text: validText }).yaml;
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: aiYaml } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock;

    try {
      const response = await POST(
        jsonRequest({
          title: "雨夜来信",
          text: validText,
          modelConfig: {
            provider: "openai-compatible",
            apiKey: "request-key",
            baseUrl: "https://request.example.test/v1",
            model: "request-model",
            temperature: 0.4
          }
        })
      );
      const body = await response.json();
      const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
        model: string;
        temperature: number;
      };

      expect(response.status).toBe(200);
      expect(body.report.provider).toBe("openai-compatible");
      expect(fetchMock.mock.calls[0][0]).toBe("https://request.example.test/v1/chat/completions");
      expect(requestBody).toMatchObject({
        model: "request-model",
        temperature: 0.4
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 400 for invalid model config", async () => {
    const response = await POST(
      jsonRequest({
        title: "雨夜来信",
        text: validText,
        modelConfig: {
          provider: "openai-compatible",
          temperature: 2
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("temperature must be between 0 and 1");
  });
});
