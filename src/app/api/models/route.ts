import { NextResponse } from "next/server";
import { z } from "zod";
import { listOpenAICompatibleModels } from "@/lib/openai-compatible";

const ModelsRequestSchema = z.object({
  apiKey: z.string(),
  baseUrl: z.string().optional(),
  provider: z.enum(["openai-compatible"]).optional()
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "生产环境不支持从浏览器获取模型列表" }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const parsed = ModelsRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const models = await listOpenAICompatibleModels(
      {
        apiKey: parsed.data.apiKey,
        baseUrl: parsed.data.baseUrl
      },
      fetch
    );
    return NextResponse.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取模型列表失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
