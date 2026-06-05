import { describe, expect, it } from "vitest";
import { buildSessionCookieOptions, hashSessionToken, SESSION_COOKIE_NAME } from "./session";

describe("session helpers", () => {
  it("hashes session token as sha256 hex", () => {
    expect(hashSessionToken("token-value")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken("token-value")).toBe(hashSessionToken("token-value"));
    expect(hashSessionToken("other-token")).not.toBe(hashSessionToken("token-value"));
  });

  it("uses HttpOnly SameSite Lax cookie options", () => {
    expect(SESSION_COOKIE_NAME).toBe("qiniuyun_session");
    expect(buildSessionCookieOptions("production")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/"
    });
    expect(buildSessionCookieOptions("development")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/"
    });
  });
});
