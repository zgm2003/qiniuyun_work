import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { saveAIProviderSettings } from "@/lib/server/ai-provider-settings";

vi.mock("@/lib/server/ai-provider-settings", () => ({
  saveAIProviderSettings: vi.fn()
}));

const saveAIProviderSettingsMock = vi.mocked(saveAIProviderSettings);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/provider-settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/provider-settings", () => {
  beforeEach(() => {
    saveAIProviderSettingsMock.mockReset();
  });

  it("saves provider settings without returning API key material", async () => {
    saveAIProviderSettingsMock.mockResolvedValue({
      id: "provider-1",
      name: "OpenAI Compatible",
      driver: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      status: "enabled",
      isDefault: true,
      healthStatus: "unknown",
      healthMessage: null,
      lastHealthCheckedAt: null,
      hasApiKey: true,
      createdAt: "2026-06-06T01:00:00.000Z",
      updatedAt: "2026-06-06T01:00:00.000Z"
    });

    const response = await POST(
      jsonRequest({
        provider: "openai-compatible",
        name: "OpenAI Compatible",
        baseUrl: "https://api.openai.com",
        apiKey: "sk-live-secret",
        model: "gpt-5.4"
      })
    );
    const body = await response.json();
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(201);
    expect(body.provider).toMatchObject({ id: "provider-1", hasApiKey: true });
    expect(serializedBody).not.toContain("sk-live-secret");
    expect(serializedBody).not.toContain("api_key_ciphertext");
    expect(saveAIProviderSettingsMock).toHaveBeenCalledWith({
      name: "OpenAI Compatible",
      driver: "openai-compatible",
      baseUrl: "https://api.openai.com",
      apiKey: "sk-live-secret",
      defaultModel: "gpt-5.4",
      status: "enabled",
      isDefault: true
    });
  });

  it("returns 400 for blank model settings fields", async () => {
    const response = await POST(jsonRequest({ provider: "openai-compatible", name: "", baseUrl: "", apiKey: "", model: "" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("供应商名称不能为空");
    expect(saveAIProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("returns service errors without exposing request API keys", async () => {
    saveAIProviderSettingsMock.mockRejectedValue(new Error("AI_CONFIG_MASTER_KEY 未配置"));

    const response = await POST(
      jsonRequest({
        provider: "openai-compatible",
        name: "OpenAI Compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-live-secret",
        model: "gpt-5.4"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("AI_CONFIG_MASTER_KEY 未配置");
    expect(JSON.stringify(body)).not.toContain("sk-live-secret");
  });
});
