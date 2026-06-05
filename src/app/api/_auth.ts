import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getUserBySessionToken, type UserSummary } from "@/lib/server/auth";

export async function readCurrentUser(): Promise<UserSummary | null> {
  const cookieStore = await cookies();
  return getUserBySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
