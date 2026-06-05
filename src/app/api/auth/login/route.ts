import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSessionCookieOptions, SESSION_COOKIE_NAME, type RuntimeEnvironment } from "@/lib/auth/session";
import { loginUser } from "@/lib/server/auth";

const LoginRequestSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "密码不能为空")
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

  const parsed = LoginRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await loginUser(parsed.data);
    const response = NextResponse.json({ user: result.user });
    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, buildSessionCookieOptions(runtimeEnvironment()));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
