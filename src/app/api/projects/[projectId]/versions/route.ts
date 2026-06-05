import { NextResponse } from "next/server";
import { z } from "zod";
import { readCurrentUser } from "@/app/api/_auth";
import { createScriptVersion } from "@/lib/server/projects";

const ConversionReportSchema = z.object({
  provider: z.enum(["mock", "openai-compatible"]),
  chapterCount: z.number(),
  characterCount: z.number(),
  sceneCount: z.number(),
  dialogueLineCount: z.number(),
  validationPassed: z.boolean()
});

const CreateScriptVersionRequestSchema = z.object({
  yaml: z.string().refine((value) => value.trim().length > 0, "YAML 不能为空"),
  report: ConversionReportSchema
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

  const parsed = CreateScriptVersionRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const projectId = await readProjectId(context);
    const user = await readCurrentUser();
    const version = await createScriptVersion({
      projectId,
      yaml: parsed.data.yaml,
      report: parsed.data.report,
      ownerUserId: user?.id
    });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "剧本版本保存失败";
    if (message === "projectId 不能为空") {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (message.startsWith("YAML 未通过 Schema 校验")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (message === "项目不存在") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: "剧本版本保存失败" }, { status: 500 });
  }
}
