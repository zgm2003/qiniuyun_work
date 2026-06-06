import { NextResponse } from "next/server";
import { z } from "zod";
import { convertNovelWithProvider, type RequestModelConfig } from "@/lib/ai-provider";
import { createScriptVersion, getProject, recordGenerationRun } from "@/lib/server/projects";

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
  projectId: z.string().refine((value) => value.trim().length > 0, "projectId 不能为空").optional(),
  title: z.string().min(1, "标题不能为空"),
  text: z.string().min(1, "小说正文不能为空"),
  modelConfig: ModelConfigSchema.optional()
});

function sanitizeModelConfigForRuntime(modelConfig: RequestModelConfig | undefined): RequestModelConfig | undefined {
  if (process.env.NODE_ENV !== "production") {
    return modelConfig;
  }

  if (!modelConfig) {
    return undefined;
  }

  if (modelConfig.provider === "mock") {
    return { provider: "mock" };
  }

  return {
    provider: "openai-compatible",
    temperature: modelConfig.temperature
  };
}

function resolveRunProvider(modelConfig: RequestModelConfig | undefined): "mock" | "openai-compatible" {
  if (process.env.NODE_ENV === "production") {
    return "openai-compatible";
  }

  return modelConfig?.provider ?? "mock";
}

function resolveRunModel(modelConfig: RequestModelConfig | undefined): string {
  const provider = resolveRunProvider(modelConfig);
  if (provider === "mock") {
    return "mock";
  }

  const configuredModel = modelConfig?.model?.trim() || process.env.OPENAI_COMPATIBLE_MODEL?.trim();
  if (configuredModel) {
    return configuredModel;
  }

  return "server-default";
}

async function recordBoundGenerationRun(input: {
  projectId: string | undefined;
  modelConfig: RequestModelConfig | undefined;
  status: "succeeded" | "failed";
  errorMessage: string | null;
}) {
  if (!input.projectId) {
    return;
  }

  await recordGenerationRun({
    projectId: input.projectId,
    provider: resolveRunProvider(input.modelConfig),
    model: resolveRunModel(input.modelConfig),
    status: input.status,
    errorMessage: input.errorMessage
  });
}

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

  if (parsed.data.projectId) {
    const project = await getProject(parsed.data.projectId);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }
  }

  try {
    const result = await convertNovelWithProvider(
      parsed.data,
      process.env,
      fetch,
      sanitizeModelConfigForRuntime(parsed.data.modelConfig)
    );
    if (parsed.data.projectId) {
      await createScriptVersion({
        projectId: parsed.data.projectId,
        yaml: result.yaml,
        report: result.report
      });
    }
    await recordBoundGenerationRun({
      projectId: parsed.data.projectId,
      modelConfig: parsed.data.modelConfig,
      status: "succeeded",
      errorMessage: null
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "转换失败";
    await recordBoundGenerationRun({
      projectId: parsed.data.projectId,
      modelConfig: parsed.data.modelConfig,
      status: "failed",
      errorMessage: message
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
