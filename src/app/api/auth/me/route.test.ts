import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserBySessionToken } from "@/lib/server/auth";
import { GET } from "./route";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "session-token" }) }))
}));

vi.mock("@/lib/server/auth", () => ({
  getUserBySessionToken: vi.fn()
}));

const getUserBySessionTokenMock = vi.mocked(getUserBySessionToken);

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    getUserBySessionTokenMock.mockReset();
  });

  it("returns current user without sensitive fields", async () => {
    getUserBySessionTokenMock.mockResolvedValue({ id: "user-1", email: "author@example.com", name: "作者" });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ user: { id: "user-1", email: "author@example.com", name: "作者" } });
    expect(getUserBySessionTokenMock).toHaveBeenCalledWith("session-token");
  });
});
