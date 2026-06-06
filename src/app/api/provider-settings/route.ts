import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultAIProviderSettings, saveAIProviderSettings } from "@/lib/server/ai-provider-settings";

export const runtime = "nodejs";

const ProviderSettingsRequestSchema = z.object({
  provider: z.enum(["openai-compatible"]),
  name: z.string().refine((value) => value.trim().length > 0, "供应商名称不能为空"),
  baseUrl: z.string().refine((value) => value.trim().length > 0, "Base URL 不能为空"),
  apiKey: z.string().refine((value) => value.trim().length > 0, "API Key 不能为空"),
  model: z.string().refine((value) => value.trim().length > 0, "默认模型不能为空")
});


function toProviderSettingsResponse(provider: Awaited<ReturnType<typeof getDefaultAIProviderSettings>>) {
  if (!provider) {
    return null;
  }

  return {
    id: provider.id,
    provider: provider.driver,
    name: provider.name,
    baseUrl: provider.baseUrl,
    model: provider.defaultModel,
    hasApiKey: provider.hasApiKey,
    healthStatus: provider.healthStatus,
    healthMessage: provider.healthMessage,
    lastHealthCheckedAt: provider.lastHealthCheckedAt,
    updatedAt: provider.updatedAt
  };
}

export async function GET() {
  try {
    const provider = await getDefaultAIProviderSettings();
    return NextResponse.json({ provider: toProviderSettingsResponse(provider) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider 读取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const parsed = ProviderSettingsRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const existingDefaultProvider = await getDefaultAIProviderSettings();
    const provider = await saveAIProviderSettings({
      id: existingDefaultProvider?.id,
      name: parsed.data.name,
      driver: parsed.data.provider,
      baseUrl: parsed.data.baseUrl,
      apiKey: parsed.data.apiKey,
      defaultModel: parsed.data.model,
      status: "enabled",
      isDefault: true
    });
    return NextResponse.json({ provider }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider 保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
