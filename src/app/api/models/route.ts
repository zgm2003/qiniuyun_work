import { NextResponse } from "next/server";
import { z } from "zod";
import { listOpenAICompatibleModels } from "@/lib/openai-compatible";

const ModelsRequestSchema = z.object({
  provider: z.enum(["mock", "openai-compatible"]),
  apiKey: z.string(),
  baseUrl: z.string().optional()
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const parsed = ModelsRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json({ error: firstIssue.message }, { status: 400 });
  }

  if (parsed.data.provider !== "openai-compatible") {
    return NextResponse.json({ error: "只支持 OpenAI-compatible 模型列表" }, { status: 400 });
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
