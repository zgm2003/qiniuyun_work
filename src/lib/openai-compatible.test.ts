import { describe, expect, it, vi } from "vitest";
import { listOpenAICompatibleModels, normalizeOpenAIBaseUrl } from "./openai-compatible";

describe("openai compatible helpers", () => {
  it("normalizes base URL by appending /v1 when missing", () => {
    expect(normalizeOpenAIBaseUrl("https://llm.example.test")).toBe("https://llm.example.test/v1");
    expect(normalizeOpenAIBaseUrl("https://llm.example.test/v1/")).toBe("https://llm.example.test/v1");
  });

  it("lists model ids from the OpenAI-compatible /models endpoint", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          object: "list",
          data: [
            { id: "gpt-4.1-mini", object: "model" },
            { id: "gpt-4.1", object: "model" }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await listOpenAICompatibleModels(
      { apiKey: "request-key", baseUrl: "https://llm.example.test" },
      fetchImpl
    );

    expect(result).toEqual(["gpt-4.1", "gpt-4.1-mini"]);
    expect(fetchImpl).toHaveBeenCalledWith("https://llm.example.test/v1/models", {
      method: "GET",
      headers: {
        authorization: "Bearer request-key"
      }
    });
  });

  it("fails loudly when API key is missing", async () => {
    const fetchImpl = vi.fn();

    await expect(listOpenAICompatibleModels({ apiKey: "", baseUrl: "https://llm.example.test" }, fetchImpl)).rejects.toThrow(
      "API Key 不能为空"
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects non-json model responses with a useful preview", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("<!doctype html><title>Not Found</title>", {
        status: 404,
        headers: { "content-type": "text/html" }
      })
    );

    await expect(
      listOpenAICompatibleModels({ apiKey: "request-key", baseUrl: "https://wrong.example.test" }, fetchImpl)
    ).rejects.toThrow("模型列表接口返回了 HTML 页面，不是 JSON");
  });
});
