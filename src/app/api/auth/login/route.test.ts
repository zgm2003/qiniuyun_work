import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginUser } from "@/lib/server/auth";
import { POST } from "./route";

vi.mock("@/lib/server/auth", () => ({
  loginUser: vi.fn()
}));

const loginUserMock = vi.mocked(loginUser);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    loginUserMock.mockReset();
  });

  it("sets a session cookie and returns user summary", async () => {
    loginUserMock.mockResolvedValue({
      user: { id: "user-1", email: "author@example.com", name: "作者" },
      sessionToken: "session-token"
    });

    const response = await POST(jsonRequest({ email: "author@example.com", password: "long-password" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("qiniuyun_session=session-token");
    expect(body).toEqual({ user: { id: "user-1", email: "author@example.com", name: "作者" } });
  });

  it("returns 400 for invalid credentials", async () => {
    loginUserMock.mockRejectedValue(new Error("邮箱或密码错误"));

    const response = await POST(jsonRequest({ email: "author@example.com", password: "bad-password" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("邮箱或密码错误");
  });
});
