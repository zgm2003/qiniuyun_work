import { parseNovelChapters, requireMinimumChapters } from "./chapters";
import { DEFAULT_OPENAI_BASE_URL, normalizeOpenAIBaseUrl } from "./openai-compatible";
import {
  validateScriptYaml,
  type ScriptDocument,
  type ScriptValidationError
} from "./script-schema";
import {
  convertNovelToScript,
  type ConversionReport,
  type NovelConversionInput,
  type NovelConversionResult
} from "./mock-converter";

export type ProviderEnvironment = Record<string, string | undefined>;
export type FetchImplementation = typeof fetch;
export type ProviderName = "mock" | "openai-compatible";

export type RequestModelConfig = {
  provider: ProviderName;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
};

const DEFAULT_MODEL = "gpt-5.5";

function stripYamlFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:yaml|yml)?\s*\n([\s\S]*?)\n```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function joinValidationErrors(errors: ScriptValidationError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join("; ");
}

function countDialogue(document: ScriptDocument): number {
  return document.scenes.reduce((count, scene) => count + scene.dialogue.length, 0);
}

function buildReport(provider: ConversionReport["provider"], document: ScriptDocument): ConversionReport {
  return {
    provider,
    chapterCount: document.metadata.source_chapters,
    characterCount: document.characters.length,
    sceneCount: document.scenes.length,
    dialogueLineCount: countDialogue(document),
    validationPassed: true
  };
}

function buildPrompt(input: NovelConversionInput): string {
  const chapters = parseNovelChapters(input.text);
  requireMinimumChapters(chapters, 3);

  return `你是小说改编剧本助手。请把下面小说改编成严格 YAML，不要输出解释文字，不要 Markdown 代码块。

硬性要求：
- 顶层只能包含 metadata、characters、scenes、summary
- metadata 必须包含 title、source_chapters、language、format_version
- metadata.title 必须是 "${input.title}"
- metadata.source_chapters 必须是 ${chapters.length}
- metadata.language 必须是 "zh-CN"
- metadata.format_version 必须是 "1.0"
- characters 必须是数组，每个角色必须包含 id、name、role、traits
- characters[*].id 使用 char_001、char_002 这种稳定 ID
- characters[*].role 只能是 protagonist、antagonist、supporting、narrator、other
- characters[*].traits 必须是字符串数组，至少 1 项
- 每个 scene 必须包含 id、chapter、heading、location、time、characters、action、dialogue、camera_notes
- scenes[*].id 使用 scene_001、scene_002 这种稳定 ID
- scenes[*].characters 必须引用 characters[*].id，不要直接写角色名
- dialogue 至少一条，每条包含 character、line、emotion
- dialogue[*].character 必须引用 characters[*].id
- summary 必须是对象，必须包含 logline、themes、adaptation_notes
- summary.themes 必须是字符串数组
- summary.adaptation_notes 必须是字符串数组
- 禁止把 summary 输出成字符串
- 不知道的内容也要根据小说合理改编，但不能省略必填字段
- 所有必填字段都必须输出；不要省略 language、format_version、id、traits、summary

必须严格参考这个 YAML 形状：
metadata:
  title: "${input.title}"
  source_chapters: ${chapters.length}
  language: "zh-CN"
  format_version: "1.0"
characters:
  - id: "char_001"
    name: "角色名"
    role: "protagonist"
    traits:
      - "性格特征"
scenes:
  - id: "scene_001"
    chapter: 1
    heading: "场景标题"
    location: "地点"
    time: "时间"
    characters:
      - "char_001"
    action: "动作描述"
    dialogue:
      - character: "char_001"
        line: "台词"
        emotion: "情绪"
    camera_notes: "镜头或舞台提示"
summary:
  logline: "一句话故事梗概"
  themes:
    - "主题"
  adaptation_notes:
    - "改编说明"

小说：
${input.text}`;
}

async function readOpenAICompatiblePayload(response: Response): Promise<{
  choices?: Array<{ message?: { content?: string } }>;
}> {
  const contentType = response.headers.get("content-type") ?? "";
  const bodyText = await response.text();
  const preview = bodyText.trim().replace(/\s+/g, " ").slice(0, 160);

  if (contentType.toLowerCase().includes("text/html") || bodyText.trimStart().startsWith("<")) {
    throw new Error(`AI 服务返回了 HTML 页面，不是 JSON。请检查 Base URL 是否应以 /v1 结尾。响应预览：${preview}`);
  }

  try {
    return JSON.parse(bodyText) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
  } catch {
    throw new Error(`AI 服务返回了无法解析的 JSON。响应预览：${preview}`);
  }
}

async function convertWithOpenAICompatible(
  input: NovelConversionInput,
  env: ProviderEnvironment,
  fetchImpl: FetchImplementation,
  modelConfig?: RequestModelConfig
): Promise<NovelConversionResult> {
  const apiKey = modelConfig?.apiKey || env.OPENAI_COMPATIBLE_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_COMPATIBLE_API_KEY 未配置");
  }

  const baseUrl = normalizeOpenAIBaseUrl(modelConfig?.baseUrl ?? env.OPENAI_COMPATIBLE_BASE_URL ?? DEFAULT_OPENAI_BASE_URL);
  const model = modelConfig?.model ?? env.OPENAI_COMPATIBLE_MODEL ?? DEFAULT_MODEL;
  const temperature = modelConfig?.temperature ?? 0.2;
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      temperature,
      messages: [
        {
          role: "system",
          content: "你只输出符合要求的 YAML。不要 Markdown 解释，不要额外注释。"
        },
        {
          role: "user",
          content: buildPrompt(input)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI 服务请求失败：${response.status}`);
  }

  const payload = await readOpenAICompatiblePayload(response);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI 服务没有返回剧本内容");
  }

  const yaml = stripYamlFence(content);
  const validation = validateScriptYaml(yaml);
  if (!validation.ok) {
    throw new Error(`AI 返回的 YAML 未通过 Schema 校验：${joinValidationErrors(validation.errors)}`);
  }

  return {
    yaml,
    report: buildReport("openai-compatible", validation.document)
  };
}

export async function convertNovelWithProvider(
  input: NovelConversionInput,
  env: ProviderEnvironment = process.env,
  fetchImpl: FetchImplementation = fetch,
  modelConfig?: RequestModelConfig
): Promise<NovelConversionResult> {
  const isProduction = env.NODE_ENV === "production";
  const defaultProvider = isProduction ? "openai-compatible" : "mock";
  const provider = modelConfig?.provider ?? env.AI_PROVIDER ?? defaultProvider;

  if (provider === "mock") {
    if (isProduction) {
      throw new Error("生产环境不允许使用 mock provider");
    }

    return convertNovelToScript(input);
  }

  if (provider === "openai-compatible") {
    return convertWithOpenAICompatible(input, env, fetchImpl, modelConfig);
  }

  throw new Error(`不支持的 AI_PROVIDER：${provider}`);
}
