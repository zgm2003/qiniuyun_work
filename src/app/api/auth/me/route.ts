import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getUserBySessionToken } from "@/lib/server/auth";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  return NextResponse.json({ user });
}
