import { beforeEach, describe, expect, it, vi } from "vitest";
import { logoutSession } from "@/lib/server/auth";
import { POST } from "./route";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "session-token" }) }))
}));

vi.mock("@/lib/server/auth", () => ({
  logoutSession: vi.fn()
}));

const logoutSessionMock = vi.mocked(logoutSession);

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    logoutSessionMock.mockReset();
  });

  it("clears the session cookie", async () => {
    logoutSessionMock.mockResolvedValue(undefined);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("qiniuyun_session=");
    expect(body).toEqual({ ok: true });
    expect(logoutSessionMock).toHaveBeenCalledWith("session-token");
  });
});
