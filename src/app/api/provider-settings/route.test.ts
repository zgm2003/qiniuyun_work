import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { getDefaultAIProviderSettings, saveAIProviderSettings } from "@/lib/server/ai-provider-settings";

vi.mock("@/lib/server/ai-provider-settings", () => ({
  getDefaultAIProviderSettings: vi.fn(),
  saveAIProviderSettings: vi.fn()
}));

const getDefaultAIProviderSettingsMock = vi.mocked(getDefaultAIProviderSettings);
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
    getDefaultAIProviderSettingsMock.mockReset();
    saveAIProviderSettingsMock.mockReset();
  });

  it("saves the single AI setting without returning API key material", async () => {
    saveAIProviderSettingsMock.mockResolvedValue({
      id: "default",
      name: "OpenAI Compatible",
      driver: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      status: "enabled",
      isDefault: true,
      healthStatus: "unknown",
      healthMessage: null,
      lastHealthCheckedAt: null,
      hasApiKey: true,
      defaultModel: "gpt-5.4",
      createdAt: "2026-06-06T01:00:00.000Z",
      updatedAt: "2026-06-06T01:00:00.000Z"
    });

    const response = await POST(
      jsonRequest({
        baseUrl: "https://api.openai.com",
        apiKey: "sk-live-secret",
        model: "gpt-5.4"
      })
    );
    const body = await response.json();
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(201);
    expect(body.provider).toMatchObject({ id: "default", hasApiKey: true, model: "gpt-5.4" });
    expect(serializedBody).not.toContain("sk-live-secret");
    expect(serializedBody).not.toContain("api_key_ciphertext");
    expect(saveAIProviderSettingsMock).toHaveBeenCalledWith({
      baseUrl: "https://api.openai.com",
      apiKey: "sk-live-secret",
      model: "gpt-5.4"
    });
    expect(getDefaultAIProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("keeps old provider/name payload fields compatible but ignores them as storage dimensions", async () => {
    saveAIProviderSettingsMock.mockResolvedValue({
      id: "default",
      name: "OpenAI Compatible",
      driver: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      status: "enabled",
      isDefault: true,
      healthStatus: "unknown",
      healthMessage: null,
      lastHealthCheckedAt: null,
      hasApiKey: true,
      defaultModel: "gpt-5.4",
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

    expect(response.status).toBe(201);
    expect(saveAIProviderSettingsMock).toHaveBeenCalledWith({
      baseUrl: "https://api.openai.com",
      apiKey: "sk-live-secret",
      model: "gpt-5.4"
    });
  });

  it("returns 400 for blank model settings fields", async () => {
    const response = await POST(jsonRequest({ baseUrl: "", apiKey: "", model: "" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Base URL 不能为空");
    expect(saveAIProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("returns service errors without exposing request API keys", async () => {
    saveAIProviderSettingsMock.mockRejectedValue(new Error("AI_CONFIG_MASTER_KEY 未配置"));

    const response = await POST(
      jsonRequest({
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

describe("GET /api/provider-settings", () => {
  beforeEach(() => {
    getDefaultAIProviderSettingsMock.mockReset();
    saveAIProviderSettingsMock.mockReset();
  });

  it("returns the single database AI setting without secret material", async () => {
    getDefaultAIProviderSettingsMock.mockResolvedValue({
      id: "default",
      name: "OpenAI Compatible",
      driver: "openai-compatible",
      baseUrl: "https://lingsuan.top/v1",
      status: "enabled",
      isDefault: true,
      healthStatus: "unknown",
      healthMessage: null,
      lastHealthCheckedAt: null,
      hasApiKey: true,
      defaultModel: "gpt-5.5",
      createdAt: "2026-06-06T01:00:00.000Z",
      updatedAt: "2026-06-06T01:00:00.000Z"
    });

    const response = await GET();
    const body = await response.json();
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.provider).toMatchObject({
      id: "default",
      provider: "openai-compatible",
      baseUrl: "https://lingsuan.top/v1",
      model: "gpt-5.5",
      hasApiKey: true
    });
    expect(serializedBody).not.toContain("api_key_ciphertext");
    expect(serializedBody).not.toContain("api_key_iv");
    expect(serializedBody).not.toContain("api_key_auth_tag");
    expect(serializedBody).not.toContain("sk-");
  });

  it("returns null when no database AI setting is configured", async () => {
    getDefaultAIProviderSettingsMock.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.provider).toBeNull();
  });
});
