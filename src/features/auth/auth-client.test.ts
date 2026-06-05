import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentUser, login, logout, register } from "./auth-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("auth client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the current user", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ user: { id: "user-1", email: "author@example.com", name: "作者" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentUser()).resolves.toEqual({ id: "user-1", email: "author@example.com", name: "作者" });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", { cache: "no-store" });
  });

  it("logs in and registers through JSON APIs", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ user: { id: "user-1", email: "author@example.com", name: "作者" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(login("author@example.com", "long-password")).resolves.toMatchObject({ id: "user-1" });
    await expect(register("author@example.com", "long-password", "作者")).resolves.toMatchObject({ id: "user-1" });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "author@example.com", password: "long-password" })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "author@example.com", password: "long-password", name: "作者" })
    });
  });

  it("throws server error messages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "邮箱或密码错误" }, 400)));

    await expect(login("author@example.com", "bad-password")).rejects.toThrow("邮箱或密码错误");
  });

  it("logs out", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });
});
