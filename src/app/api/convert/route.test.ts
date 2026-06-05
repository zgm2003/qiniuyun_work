import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { convertNovelToScript } from "@/lib/mock-converter";
import { validateScriptYaml } from "@/lib/script-schema";

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

type ChatRequestBody = {
  model: string;
  temperature: number;
  messages: Array<{ role: "system" | "user"; content: string }>;
};

type ResponsesRequestBody = {
  model: string;
  temperature: number;
  instructions: string;
  input: string;
};

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
      const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as ChatRequestBody;

      expect(response.status).toBe(200);
      expect(body.report.provider).toBe("openai-compatible");
      expect(fetchMock.mock.calls[0][0]).toBe("https://request.example.test/v1/chat/completions");
      expect(requestBody).toMatchObject({
        model: "request-model",
        temperature: 0.4
      });
      expect(requestBody.messages[0].content).toContain("YAML");
      expect(requestBody.messages[1].content).toContain("结构要求");
      expect(requestBody.messages[1].content).toContain("质量规则");
      expect(requestBody.messages[1].content).toContain("第1章 雨夜来信");
      expect(requestBody.messages[1].content).not.toContain("{{title}}");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("ignores browser API key, base URL, and model overrides in production", async () => {
    const originalFetch = globalThis.fetch;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalProvider = process.env.AI_PROVIDER;
    const originalApiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
    const originalBaseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
    const originalModel = process.env.OPENAI_COMPATIBLE_MODEL;
    const originalGenerationApi = process.env.OPENAI_COMPATIBLE_GENERATION_API;
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text: validText }).yaml;
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: aiYaml } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    vi.stubEnv("NODE_ENV", "production");
    process.env.AI_PROVIDER = "openai-compatible";
    process.env.OPENAI_COMPATIBLE_API_KEY = "env-key";
    process.env.OPENAI_COMPATIBLE_BASE_URL = "https://env.example.test/v1";
    process.env.OPENAI_COMPATIBLE_MODEL = "env-model";
    process.env.OPENAI_COMPATIBLE_GENERATION_API = "chat-completions";
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
      const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as ChatRequestBody;

      expect(response.status).toBe(200);
      expect(body.report.provider).toBe("openai-compatible");
      expect(fetchMock.mock.calls[0][0]).toBe("https://env.example.test/v1/chat/completions");
      expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
        authorization: "Bearer env-key"
      });
      expect(requestBody).toMatchObject({
        model: "env-model",
        temperature: 0.4
      });
      expect(requestBody.messages[0].content).toContain("YAML");
      expect(requestBody.messages[1].content).toContain("结构要求");
      expect(requestBody.messages[1].content).toContain("质量规则");
      expect(requestBody.messages[1].content).toContain("第1章 雨夜来信");
      expect(requestBody.messages[1].content).not.toContain("{{title}}");
    } finally {
      globalThis.fetch = originalFetch;
      vi.stubEnv("NODE_ENV", originalNodeEnv);
      process.env.AI_PROVIDER = originalProvider;
      process.env.OPENAI_COMPATIBLE_API_KEY = originalApiKey;
      process.env.OPENAI_COMPATIBLE_BASE_URL = originalBaseUrl;
      process.env.OPENAI_COMPATIBLE_MODEL = originalModel;
      process.env.OPENAI_COMPATIBLE_GENERATION_API = originalGenerationApi;
    }
  });

  it("keeps production request-level overrides sanitized in Responses mode", async () => {
    const originalFetch = globalThis.fetch;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalProvider = process.env.AI_PROVIDER;
    const originalApiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
    const originalBaseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
    const originalModel = process.env.OPENAI_COMPATIBLE_MODEL;
    const originalGenerationApi = process.env.OPENAI_COMPATIBLE_GENERATION_API;
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text: validText }).yaml;
    const parsed = validateScriptYaml(aiYaml);
    if (!parsed.ok) {
      throw new Error("test fixture must be valid");
    }
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(parsed.document) }]
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    vi.stubEnv("NODE_ENV", "production");
    process.env.AI_PROVIDER = "openai-compatible";
    process.env.OPENAI_COMPATIBLE_API_KEY = "env-key";
    process.env.OPENAI_COMPATIBLE_BASE_URL = "https://env.example.test/v1";
    process.env.OPENAI_COMPATIBLE_MODEL = "env-model";
    process.env.OPENAI_COMPATIBLE_GENERATION_API = "responses";
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
      const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as ResponsesRequestBody;
      const serializedRequestBody = JSON.stringify(requestBody);

      expect(response.status).toBe(200);
      expect(body.report.provider).toBe("openai-compatible");
      expect(fetchMock.mock.calls[0][0]).toBe("https://env.example.test/v1/responses");
      expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
        authorization: "Bearer env-key"
      });
      expect(requestBody).toMatchObject({
        model: "env-model",
        temperature: 0.4
      });
      expect(requestBody.instructions).toContain("JSON");
      expect(requestBody.input).toContain("结构要求");
      expect(requestBody.input).toContain("质量规则");
      expect(requestBody.input).toContain("第1章 雨夜来信");
      expect(requestBody.input).not.toContain("{{title}}");
      expect(serializedRequestBody).not.toContain("request-key");
      expect(serializedRequestBody).not.toContain("request-model");
      expect(serializedRequestBody).not.toContain("request.example.test");
    } finally {
      globalThis.fetch = originalFetch;
      vi.stubEnv("NODE_ENV", originalNodeEnv);
      process.env.AI_PROVIDER = originalProvider;
      process.env.OPENAI_COMPATIBLE_API_KEY = originalApiKey;
      process.env.OPENAI_COMPATIBLE_BASE_URL = originalBaseUrl;
      process.env.OPENAI_COMPATIBLE_MODEL = originalModel;
      process.env.OPENAI_COMPATIBLE_GENERATION_API = originalGenerationApi;
    }
  });

  it("rejects request-level mock provider in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalProvider = process.env.AI_PROVIDER;
    const originalApiKey = process.env.OPENAI_COMPATIBLE_API_KEY;

    vi.stubEnv("NODE_ENV", "production");
    process.env.AI_PROVIDER = "openai-compatible";
    process.env.OPENAI_COMPATIBLE_API_KEY = "env-key";

    try {
      const response = await POST(
        jsonRequest({
          title: "雨夜来信",
          text: validText,
          modelConfig: {
            provider: "mock"
          }
        })
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("生产环境不允许使用 mock provider");
    } finally {
      vi.stubEnv("NODE_ENV", originalNodeEnv);
      process.env.AI_PROVIDER = originalProvider;
      process.env.OPENAI_COMPATIBLE_API_KEY = originalApiKey;
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
