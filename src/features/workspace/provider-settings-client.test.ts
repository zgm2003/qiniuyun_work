import { describe, expect, test, vi } from "vitest";
import { loadProviderSettings, saveProviderSettings } from "./provider-settings-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("provider settings client", () => {
  test("loads the single database AI setting without API key material", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        provider: {
          id: "default",
          provider: "openai-compatible",
          baseUrl: "https://lingsuan.top/v1",
          model: "gpt-5.5",
          hasApiKey: true
        }
      })
    );

    await expect(loadProviderSettings(fetchImpl)).resolves.toEqual({
      id: "default",
      baseUrl: "https://lingsuan.top/v1",
      model: "gpt-5.5",
      hasApiKey: true
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/provider-settings", { method: "GET" });
  });

  test("posts the one AI setting to the database-backed API", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ provider: { id: "default", hasApiKey: true, model: "gpt-5.4" } }, 201));

    const provider = await saveProviderSettings(
      {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-live-secret",
        model: "gpt-5.4"
      },
      fetchImpl
    );

    expect(provider).toEqual({ id: "default", hasApiKey: true, model: "gpt-5.4" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/provider-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-live-secret",
        model: "gpt-5.4"
      })
    });
  });

  test("throws API error messages without guessing fallback values", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "AI_CONFIG_MASTER_KEY 未配置" }, 500));

    await expect(
      saveProviderSettings(
        {
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-live-secret",
          model: "gpt-5.4"
        },
        fetchImpl
      )
    ).rejects.toThrow("AI_CONFIG_MASTER_KEY 未配置");
  });
});
