import { beforeEach, describe, expect, it, vi } from "vitest";
import { listOpenAICompatibleModels } from "@/lib/openai-compatible";
import { POST } from "./route";

vi.mock("@/lib/openai-compatible", () => ({
  listOpenAICompatibleModels: vi.fn()
}));

const listOpenAICompatibleModelsMock = vi.mocked(listOpenAICompatibleModels);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/models", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/models", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    listOpenAICompatibleModelsMock.mockReset();
  });

  it("fetches OpenAI-compatible models from the current form config without storing them", async () => {
    listOpenAICompatibleModelsMock.mockResolvedValue(["gpt-cheap", "gpt-balanced"]);

    const response = await POST(
      jsonRequest({
        apiKey: "sk-live-secret",
        baseUrl: "https://api.example.test"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ models: ["gpt-cheap", "gpt-balanced"] });
    expect(listOpenAICompatibleModelsMock).toHaveBeenCalledWith(
      {
        apiKey: "sk-live-secret",
        baseUrl: "https://api.example.test"
      },
      fetch
    );
    expect(JSON.stringify(body)).not.toContain("sk-live-secret");
  });

  it("keeps old provider payload compatible but does not use it as a storage dimension", async () => {
    listOpenAICompatibleModelsMock.mockResolvedValue(["gpt-cheap"]);

    const response = await POST(
      jsonRequest({
        provider: "openai-compatible",
        apiKey: "sk-live-secret",
        baseUrl: "https://api.example.test"
      })
    );

    expect(response.status).toBe(200);
    expect(listOpenAICompatibleModelsMock).toHaveBeenCalledWith(
      {
        apiKey: "sk-live-secret",
        baseUrl: "https://api.example.test"
      },
      fetch
    );
  });

  it("does not expose browser model fetching in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await POST(jsonRequest({ apiKey: "sk-live-secret", baseUrl: "https://api.example.test" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("生产环境不支持从浏览器获取模型列表");
    expect(listOpenAICompatibleModelsMock).not.toHaveBeenCalled();
  });

  it("returns validation errors before calling model APIs", async () => {
    const response = await POST(jsonRequest({ apiKey: 123, baseUrl: "https://api.example.test" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("expected string");
    expect(listOpenAICompatibleModelsMock).not.toHaveBeenCalled();
  });

  it("returns upstream errors without leaking the request API key", async () => {
    listOpenAICompatibleModelsMock.mockRejectedValue(new Error("模型列表接口请求失败：401"));

    const response = await POST(jsonRequest({ apiKey: "sk-live-secret", baseUrl: "https://api.example.test" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("模型列表接口请求失败：401");
    expect(JSON.stringify(body)).not.toContain("sk-live-secret");
  });
});
