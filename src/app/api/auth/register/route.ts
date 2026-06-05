import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSessionCookieOptions, SESSION_COOKIE_NAME, type RuntimeEnvironment } from "@/lib/auth/session";
import { createUser } from "@/lib/server/auth";

const RegisterRequestSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少需要 8 个字符"),
  name: z.string().optional()
});

function runtimeEnvironment(): RuntimeEnvironment {
  return process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test" ? process.env.NODE_ENV : "development";
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const parsed = RegisterRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await createUser(parsed.data);
    const response = NextResponse.json({ user: result.user }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, buildSessionCookieOptions(runtimeEnvironment()));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "注册失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
