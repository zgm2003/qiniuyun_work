import { NextResponse } from "next/server";
import { z } from "zod";
import { convertNovelToScript } from "@/lib/mock-converter";

const ConvertRequestSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  text: z.string().min(1, "小说正文不能为空")
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
    const result = convertNovelToScript(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "转换失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
