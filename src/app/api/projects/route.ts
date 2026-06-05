import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject } from "@/lib/server/projects";

const CreateProjectRequestSchema = z.object({
  title: z.string().refine((value) => value.trim().length > 0, "标题不能为空"),
  sourceText: z.string().refine((value) => value.trim().length > 0, "小说正文不能为空")
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const parsed = CreateProjectRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const project = await createProject(parsed.data);
    return NextResponse.json({ project }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "项目保存失败" }, { status: 500 });
  }
}
