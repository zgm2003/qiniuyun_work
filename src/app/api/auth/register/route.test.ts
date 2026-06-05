import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser } from "@/lib/server/auth";
import { POST } from "./route";

vi.mock("@/lib/server/auth", () => ({
  createUser: vi.fn()
}));

const createUserMock = vi.mocked(createUser);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    createUserMock.mockReset();
  });

  it("sets a session cookie and returns user summary", async () => {
    createUserMock.mockResolvedValue({
      user: { id: "user-1", email: "author@example.com", name: "作者" },
      sessionToken: "session-token"
    });

    const response = await POST(jsonRequest({ email: "author@example.com", password: "long-password", name: "作者" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("qiniuyun_session=session-token");
    expect(body).toEqual({ user: { id: "user-1", email: "author@example.com", name: "作者" } });
    expect(createUserMock).toHaveBeenCalledWith({ email: "author@example.com", password: "long-password", name: "作者" });
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(jsonRequest({ email: "not-email", password: "short" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("邮箱格式不正确");
    expect(createUserMock).not.toHaveBeenCalled();
  });
});
