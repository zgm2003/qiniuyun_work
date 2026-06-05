import { NextResponse } from "next/server";
import { z } from "zod";
import { recordGenerationRun } from "@/lib/server/projects";

const RecordGenerationRunRequestSchema = z.object({
  provider: z.enum(["mock", "openai-compatible"]),
  model: z.string().refine((value) => value.trim().length > 0, "model 不能为空"),
  status: z.enum(["running", "succeeded", "failed"]),
  errorMessage: z.string().nullable().optional()
});

type RouteContext = {
  params: Promise<{ projectId: string }> | { projectId: string };
};

async function readProjectId(context: RouteContext): Promise<string> {
  const params = await context.params;
  const projectId = params.projectId.trim();
  if (!projectId) {
    throw new Error("projectId 不能为空");
  }

  return projectId;
}

export async function POST(request: Request, context: RouteContext) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const parsed = RecordGenerationRunRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const projectId = await readProjectId(context);
    const run = await recordGenerationRun({
      projectId,
      provider: parsed.data.provider,
      model: parsed.data.model,
      status: parsed.data.status,
      errorMessage: parsed.data.errorMessage ?? null
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成记录保存失败";
    if (message === "projectId 不能为空") {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: "生成记录保存失败" }, { status: 500 });
  }
}
