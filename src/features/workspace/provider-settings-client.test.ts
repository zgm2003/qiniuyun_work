import { describe, expect, test, vi } from "vitest";
import { loadProviderSettings, saveProviderSettings } from "./provider-settings-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("provider settings client", () => {
  test("loads the default database provider settings without API key material", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        provider: {
          id: "provider-1",
          provider: "openai-compatible",
          name: "OpenAI Compatible",
          baseUrl: "https://lingsuan.top/v1",
          model: "gpt-5.5",
          hasApiKey: true
        }
      })
    );

    await expect(loadProviderSettings(fetchImpl)).resolves.toEqual({
      id: "provider-1",
      provider: "openai-compatible",
      name: "OpenAI Compatible",
      baseUrl: "https://lingsuan.top/v1",
      model: "gpt-5.5",
      hasApiKey: true
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/provider-settings", { method: "GET" });
  });

  test("posts provider settings to the database-backed API", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ provider: { id: "provider-1", hasApiKey: true } }, 201));

    const provider = await saveProviderSettings(
      {
        provider: "openai-compatible",
        name: "OpenAI Compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-live-secret",
        model: "gpt-5.4"
      },
      fetchImpl
    );

    expect(provider).toEqual({ id: "provider-1", hasApiKey: true });
    expect(fetchImpl).toHaveBeenCalledWith("/api/provider-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "openai-compatible",
        name: "OpenAI Compatible",
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
          provider: "openai-compatible",
          name: "OpenAI Compatible",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-live-secret",
          model: "gpt-5.4"
        },
        fetchImpl
      )
    ).rejects.toThrow("AI_CONFIG_MASTER_KEY 未配置");
  });
});