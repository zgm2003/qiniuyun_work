import { afterEach, describe, expect, it, vi } from "vitest";
import { convertNovelToScript } from "./mock-converter";

const text = `第1章 雨夜来信
林夏在旧书店收到一封没有署名的信。

第2章 地铁尽头
林夏来到末班地铁。陈默出现。

第3章 天台对峙
林夏和陈默在天台对峙。`;

describe("convertNovelWithProvider runtime AI settings", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("uses saved runtime AI settings when a refreshed development page has no browser API key", async () => {
    const aiYaml = convertNovelToScript({ title: "雨夜来信", text }).yaml;
    const resolveRuntimeAIProviderConfig = vi.fn(async () => ({
      provider: "openai-compatible" as const,
      apiKey: "db-key",
      baseUrl: "https://db.example.test/v1",
      model: "db-model"
    }));
    vi.doMock("./server/ai-provider-settings", () => ({
      resolveRuntimeAIProviderConfig
    }));

    const { convertNovelWithProvider } = await import("./ai-provider");
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
        NODE_ENV: "development",
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_GENERATION_API: "chat-completions"
      },
      fetchImpl,
      {
        provider: "openai-compatible",
        baseUrl: "https://browser-default.example.test/v1",
        model: "browser-default-model",
        temperature: 0.3
      }
    );

    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as {
      model: string;
      temperature: number;
    };

    expect(resolveRuntimeAIProviderConfig).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe("https://db.example.test/v1/chat/completions");
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
      authorization: "Bearer db-key"
    });
    expect(requestBody).toMatchObject({
      model: "db-model",
      temperature: 0.3
    });
  });
});
