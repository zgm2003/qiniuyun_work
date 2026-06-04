import { parseNovelChapters, requireMinimumChapters } from "./chapters";
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

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1-mini";

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

  return `你是小说改编剧本助手。请把下面小说改编成严格 YAML，不要输出解释文字。

硬性要求：
- metadata.source_chapters 必须是 ${chapters.length}
- 顶层只能包含 metadata、characters、scenes、summary
- 每个 scene 必须包含 id、chapter、heading、location、time、characters、action、dialogue、camera_notes
- dialogue 至少一条，每条包含 character、line、emotion
- characters 中的 role 只能是 protagonist、antagonist、supporting、narrator、other
- 不知道的内容也要根据小说合理改编，但不能省略必填字段

标题：${input.title}

小说：
${input.text}`;
}

async function convertWithOpenAICompatible(
  input: NovelConversionInput,
  env: ProviderEnvironment,
  fetchImpl: FetchImplementation
): Promise<NovelConversionResult> {
  const apiKey = env.OPENAI_COMPATIBLE_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_COMPATIBLE_API_KEY 未配置");
  }

  const baseUrl = (env.OPENAI_COMPATIBLE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = env.OPENAI_COMPATIBLE_MODEL ?? DEFAULT_MODEL;
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
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

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
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
  fetchImpl: FetchImplementation = fetch
): Promise<NovelConversionResult> {
  const provider = env.AI_PROVIDER ?? "mock";

  if (provider === "mock") {
    return convertNovelToScript(input);
  }

  if (provider === "openai-compatible") {
    return convertWithOpenAICompatible(input, env, fetchImpl);
  }

  throw new Error(`不支持的 AI_PROVIDER：${provider}`);
}
