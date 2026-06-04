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
