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

  it("production defaults to openai-compatible when AI_PROVIDER is absent", async () => {
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text }).yaml;
    const parsed = validateScriptYaml(aiYaml);
    if (!parsed.ok) {
      throw new Error("test fixture must be valid");
    }
    const fetchImpl = vi.fn(async () =>
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

    const result = await convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        NODE_ENV: "production",
        OPENAI_COMPATIBLE_API_KEY: "test-key",
        OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.test/v1",
        OPENAI_COMPATIBLE_MODEL: "demo-model"
      },
      fetchImpl
    );

    expect(result.report.provider).toBe("openai-compatible");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe("https://llm.example.test/v1/responses");
  });

  it("production rejects request modelConfig selecting mock", async () => {
    await expect(
      convertNovelWithProvider(
        { title: "雨夜来信", text },
        {
          NODE_ENV: "production",
          AI_PROVIDER: "openai-compatible",
          OPENAI_COMPATIBLE_API_KEY: "test-key"
        },
        fetch,
        { provider: "mock" }
      )
    ).rejects.toThrow("生产环境不允许使用 mock provider");
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

  it("can still use Chat Completions when generation API is explicitly configured", async () => {
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
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_GENERATION_API: "chat-completions",
        OPENAI_COMPATIBLE_API_KEY: "test-key",
        OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.test/v1",
        OPENAI_COMPATIBLE_MODEL: "demo-model"
      },
      fetchImpl
    );

    expect(result.report.provider).toBe("openai-compatible");
    expect(fetchImpl.mock.calls[0][0]).toBe("https://llm.example.test/v1/chat/completions");
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

  it("openai-compatible request body includes store:false", async () => {
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
      store?: boolean;
    };

    expect(requestBody.store).toBe(false);
  });

  it("uses the current target production model when no model is configured", async () => {
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
      model?: string;
    };

    expect(requestBody.model).toBe("gpt-5.5");
  });

  it("uses Responses API with Structured Outputs when configured", async () => {
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text }).yaml;
    const parsed = validateScriptYaml(aiYaml);
    if (!parsed.ok) {
      throw new Error("test fixture must be valid");
    }
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(parsed.document)
                }
              ]
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_GENERATION_API: "responses",
        OPENAI_COMPATIBLE_API_KEY: "test-key",
        OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.test/v1",
        OPENAI_COMPATIBLE_MODEL: "gpt-5.5"
      },
      fetchImpl
    );

    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as {
      model: string;
      store: boolean;
      text?: { format?: { type?: string; name?: string; strict?: boolean; schema?: unknown } };
    };

    expect(fetchImpl.mock.calls[0][0]).toBe("https://llm.example.test/v1/responses");
    expect(requestBody).toMatchObject({
      model: "gpt-5.5",
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "script_document",
          strict: true
        }
      }
    });
    expect(requestBody.text?.format?.schema).toBeTruthy();
    expect(result.report.provider).toBe("openai-compatible");
    expect(validateScriptYaml(result.yaml).ok).toBe(true);
  });

  it("asks Responses models for JSON rather than YAML", async () => {
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text }).yaml;
    const parsed = validateScriptYaml(aiYaml);
    if (!parsed.ok) {
      throw new Error("test fixture must be valid");
    }
    const fetchImpl = vi.fn(async () =>
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

    await convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_GENERATION_API: "responses",
        OPENAI_COMPATIBLE_API_KEY: "test-key"
      },
      fetchImpl
    );

    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as {
      input: string;
      instructions: string;
    };

    expect(requestBody.instructions).toContain("JSON Schema");
    expect(requestBody.input).toContain("输出 JSON");
    expect(requestBody.input).not.toContain("输出 YAML");
    expect(requestBody.input).not.toContain("```");
  });

  it("reports a clear Responses refusal", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [{ type: "refusal", refusal: "无法处理该请求" }]
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await expect(
      convertNovelWithProvider(
        { title: "雨夜来信", text },
        {
          AI_PROVIDER: "openai-compatible",
          OPENAI_COMPATIBLE_GENERATION_API: "responses",
          OPENAI_COMPATIBLE_API_KEY: "test-key"
        },
        fetchImpl
      )
    ).rejects.toThrow("AI 拒绝生成剧本：无法处理该请求");
  });

  it("reports invalid Responses JSON text", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "not json" }]
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await expect(
      convertNovelWithProvider(
        { title: "雨夜来信", text },
        {
          AI_PROVIDER: "openai-compatible",
          OPENAI_COMPATIBLE_GENERATION_API: "responses",
          OPENAI_COMPATIBLE_API_KEY: "test-key"
        },
        fetchImpl
      )
    ).rejects.toThrow("AI 服务返回了无法解析的 JSON");
  });

  it("reports invalid Responses script document structure", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({ summary: "bad" })
                }
              ]
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await expect(
      convertNovelWithProvider(
        { title: "雨夜来信", text },
        {
          AI_PROVIDER: "openai-compatible",
          OPENAI_COMPATIBLE_GENERATION_API: "responses",
          OPENAI_COMPATIBLE_API_KEY: "test-key"
        },
        fetchImpl
      )
    ).rejects.toThrow("AI 返回的剧本文档未通过 Schema 校验");
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
