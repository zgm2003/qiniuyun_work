import { describe, expect, test, vi } from "vitest";
import { fetchProviderModels } from "./model-list-client";

describe("model list client", () => {
  test("posts provider credentials to the model-list API and returns model ids", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ models: ["gpt-4.1", "gpt-4.1-mini"] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const models = await fetchProviderModels(
      {
        provider: "openai-compatible",
        apiKey: "request-key",
        baseUrl: "https://api.openai.com/v1"
      },
      fetchImpl
    );

    expect(models).toEqual(["gpt-4.1", "gpt-4.1-mini"]);
    expect(fetchImpl).toHaveBeenCalledWith("/api/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "openai-compatible",
        apiKey: "request-key",
        baseUrl: "https://api.openai.com/v1"
      })
    });
  });

  test("throws the API error message when model listing fails", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: "API Key 不能为空" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(
      fetchProviderModels(
        {
          provider: "openai-compatible",
          apiKey: "",
          baseUrl: "https://api.openai.com/v1"
        },
        fetchImpl
      )
    ).rejects.toThrow("API Key 不能为空");
  });

  test("rejects malformed API responses instead of guessing", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ models: ["gpt-4.1", 123] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(
      fetchProviderModels(
        {
          provider: "openai-compatible",
          apiKey: "request-key",
          baseUrl: "https://api.openai.com/v1"
        },
        fetchImpl
      )
    ).rejects.toThrow("模型列表响应格式错误");
  });
});
