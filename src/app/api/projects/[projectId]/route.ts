import { NextResponse } from "next/server";
import { z } from "zod";
import { getProject, updateProject } from "@/lib/server/projects";

const UpdateProjectRequestSchema = z.object({
  title: z.string().refine((value) => value.trim().length > 0, "标题不能为空"),
  sourceText: z.string().refine((value) => value.trim().length > 0, "小说正文不能为空")
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const project = await getProject(await readProjectId(context));
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "项目读取失败";
    if (message === "projectId 不能为空") {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: "项目读取失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const parsed = UpdateProjectRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const project = await updateProject({
      projectId: await readProjectId(context),
      title: parsed.data.title,
      sourceText: parsed.data.sourceText
    });
    return NextResponse.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "项目保存失败";
    if (message === "projectId 不能为空") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message === "项目不存在") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: "项目保存失败" }, { status: 500 });
  }
}
