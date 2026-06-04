import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/models", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/models", () => {
  it("returns OpenAI-compatible model ids from the provider", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          object: "list",
          data: [{ id: "gpt-4.1-mini" }, { id: "gpt-4.1" }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock;

    try {
      const response = await POST(
        jsonRequest({
          provider: "openai-compatible",
          apiKey: "request-key",
          baseUrl: "https://llm.example.test"
        })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ models: ["gpt-4.1", "gpt-4.1-mini"] });
      expect(fetchMock.mock.calls[0][0]).toBe("https://llm.example.test/v1/models");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects mock provider because product UI lists real providers only", async () => {
    const response = await POST(
      jsonRequest({
        provider: "mock",
        apiKey: "request-key",
        baseUrl: "https://llm.example.test/v1"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("只支持 OpenAI-compatible 模型列表");
  });

  it("returns 400 when API key is empty", async () => {
    const response = await POST(
      jsonRequest({
        provider: "openai-compatible",
        apiKey: "",
        baseUrl: "https://llm.example.test/v1"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("API Key 不能为空");
  });
});
