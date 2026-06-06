import { describe, expect, test, vi } from "vitest";
import { fetchProviderModels } from "./model-list-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("model list client", () => {
  test("fetches models for the current one-time AI config without provider dimensions", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ models: ["gpt-cheap", "gpt-balanced"] }));

    const models = await fetchProviderModels(
      {
        baseUrl: "https://api.example.test/v1",
        apiKey: "sk-live-secret"
      },
      fetchImpl
    );

    expect(models).toEqual(["gpt-cheap", "gpt-balanced"]);
    expect(fetchImpl).toHaveBeenCalledWith("/api/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.example.test/v1",
        apiKey: "sk-live-secret"
      })
    });
  });

  test("throws API error messages without guessing fallback values", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "API Key 不能为空" }, 400));

    await expect(fetchProviderModels({ baseUrl: "https://api.example.test/v1", apiKey: "" }, fetchImpl)).rejects.toThrow(
      "API Key 不能为空"
    );
  });

  test("rejects malformed model list responses", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ models: ["gpt-ok", 123] }));

    await expect(fetchProviderModels({ baseUrl: "https://api.example.test/v1", apiKey: "sk-live-secret" }, fetchImpl)).rejects.toThrow(
      "模型列表响应格式错误"
    );
  });
});
