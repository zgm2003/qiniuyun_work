import { describe, expect, it, vi } from "vitest";
import { convertNovelWithProvider } from "./ai-provider";
import { convertNovelToScript } from "./mock-converter";
import { validateScriptYaml } from "./script-schema";

const text = `第1章 雨夜来信
林夏在旧书店收到一封没有署名的信。

第2章 地铁尽头
林夏来到末班地铁。陈默出现。

第3章 天台对峙
林夏和陈默在天台对峙。`;

describe("convertNovelWithProvider", () => {
  it("uses the deterministic mock provider by default", async () => {
    const result = await convertNovelWithProvider({ title: "雨夜来信", text }, {});

    expect(result.report.provider).toBe("mock");
    expect(validateScriptYaml(result.yaml).ok).toBe(true);
  });

  it("calls an OpenAI-compatible chat completions endpoint when configured", async () => {
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text }).yaml;
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: `\n\`\`\`yaml\n${aiYaml}\n\`\`\`` } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_API_KEY: "test-key",
        OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.test/v1",
        OPENAI_COMPATIBLE_MODEL: "demo-model"
      },
      fetchImpl
    );

    expect(result.report.provider).toBe("openai-compatible");
    expect(result.report.validationPassed).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe("https://llm.example.test/v1/chat/completions");
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
      authorization: "Bearer test-key",
      "content-type": "application/json"
    });
  });

  it("lets request model config override env provider settings for one conversion", async () => {
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text }).yaml;
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: aiYaml } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "mock",
        OPENAI_COMPATIBLE_API_KEY: "env-key",
        OPENAI_COMPATIBLE_BASE_URL: "https://env.example.test/v1",
        OPENAI_COMPATIBLE_MODEL: "env-model"
      },
      fetchImpl,
      {
        provider: "openai-compatible",
        apiKey: "request-key",
        baseUrl: "https://request.example.test/v1",
        model: "request-model",
        temperature: 0.7
      }
    );

    const requestInit = fetchImpl.mock.calls[0][1];
    const requestBody = JSON.parse(String(requestInit?.body)) as {
      model: string;
      temperature: number;
    };

    expect(result.report.provider).toBe("openai-compatible");
    expect(fetchImpl.mock.calls[0][0]).toBe("https://request.example.test/v1/chat/completions");
    expect(requestInit?.headers).toMatchObject({
      authorization: "Bearer request-key"
    });
    expect(requestBody.model).toBe("request-model");
    expect(requestBody.temperature).toBe(0.7);
  });

  it("normalizes provider base URL by appending /v1 when it is missing", async () => {
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text }).yaml;
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: aiYaml } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_API_KEY: "test-key",
        OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.test",
        OPENAI_COMPATIBLE_MODEL: "demo-model"
      },
      fetchImpl
    );

    expect(fetchImpl.mock.calls[0][0]).toBe("https://llm.example.test/v1/chat/completions");
  });

  it("sends a prompt that names every required YAML schema field", async () => {
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text }).yaml;
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: aiYaml } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_API_KEY: "test-key"
      },
      fetchImpl
    );

    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const userPrompt = requestBody.messages.find((message) => message.role === "user")?.content ?? "";

    expect(userPrompt).toContain("format_version");
    expect(userPrompt).toContain("language");
    expect(userPrompt).toContain("characters");
    expect(userPrompt).toContain("id");
    expect(userPrompt).toContain("traits");
    expect(userPrompt).toContain("summary:");
    expect(userPrompt).toContain("adaptation_notes");
    expect(userPrompt).toContain("禁止把 summary 输出成字符串");
  });

  it("does not call fetch when request model config selects mock", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_API_KEY: "env-key"
      },
      fetchImpl,
      { provider: "mock" }
    );

    expect(result.report.provider).toBe("mock");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a clear error when the AI endpoint returns HTML instead of JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("<!doctype html><html><body>not found</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" }
      })
    );

    await expect(
      convertNovelWithProvider(
        { title: "雨夜来信", text },
        {
          AI_PROVIDER: "openai-compatible",
          OPENAI_COMPATIBLE_API_KEY: "test-key",
          OPENAI_COMPATIBLE_BASE_URL: "https://wrong.example.test"
        },
        fetchImpl
      )
    ).rejects.toThrow("AI 服务返回了 HTML 页面，不是 JSON");
  });

  it("accepts OpenAI-compatible JSON payloads mislabeled as text/event-stream", async () => {
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text }).yaml;
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: aiYaml } }]
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } }
      )
    );

    const result = await convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_API_KEY: "test-key",
        OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.test/v1"
      },
      fetchImpl
    );

    expect(result.report.provider).toBe("openai-compatible");
    expect(result.report.validationPassed).toBe(true);
  });

  it("fails loudly when OpenAI-compatible provider is missing an API key", async () => {
    await expect(
      convertNovelWithProvider(
        { title: "雨夜来信", text },
        {
          AI_PROVIDER: "openai-compatible",
          OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.test/v1",
          OPENAI_COMPATIBLE_MODEL: "demo-model"
        }
      )
    ).rejects.toThrow("OPENAI_COMPATIBLE_API_KEY 未配置");
  });
});
