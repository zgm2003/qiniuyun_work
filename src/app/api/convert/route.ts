import { NextResponse } from "next/server";
import { z } from "zod";
import { convertNovelWithProvider } from "@/lib/ai-provider";

const ModelConfigSchema = z.object({
  provider: z.enum(["mock", "openai-compatible"]),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  temperature: z
    .number()
    .min(0, "temperature must be between 0 and 1")
    .max(1, "temperature must be between 0 and 1")
    .optional()
});

const ConvertRequestSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  text: z.string().min(1, "小说正文不能为空"),
  modelConfig: ModelConfigSchema.optional()
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const parsed = ConvertRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json({ error: firstIssue.message }, { status: 400 });
  }

  try {
    const result = await convertNovelWithProvider(parsed.data, process.env, fetch, parsed.data.modelConfig);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "转换失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
