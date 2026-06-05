import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "qiniuyun_session";
export const SESSION_TTL_DAYS = 30;

export type RuntimeEnvironment = "production" | "development" | "test";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function buildSessionCookieOptions(nodeEnv: RuntimeEnvironment) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60
  };
}
