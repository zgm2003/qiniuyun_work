import { DEFAULT_OPENAI_BASE_URL, normalizeOpenAIBaseUrl } from "./openai-compatible";
import {
  validateScriptYaml,
  type ScriptDocument,
  type ScriptValidationError,
  parseScriptDocumentJson,
  SCRIPT_DOCUMENT_JSON_SCHEMA
} from "./script-schema";
import { scriptDocumentToValidatedYaml } from "./script-yaml";
import { buildScriptPromptVariables, renderPromptTemplate } from "./prompt-templates";
import { getPromptTemplateByKey } from "./server/prompt-templates";
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
type OpenAICompatibleGenerationApi = "chat-completions" | "responses";

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

function resolveGenerationApi(env: ProviderEnvironment): OpenAICompatibleGenerationApi {
  const configured = env.OPENAI_COMPATIBLE_GENERATION_API;
  if (!configured) {
    return env.NODE_ENV === "production" ? "responses" : "chat-completions";
  }

  if (configured === "chat-completions" || configured === "responses") {
    return configured;
  }

  throw new Error(`不支持的 OPENAI_COMPATIBLE_GENERATION_API：${configured}`);
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

type ResponsesPayload = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

async function readOpenAIResponsesPayload(response: Response): Promise<ResponsesPayload> {
  const contentType = response.headers.get("content-type") ?? "";
  const bodyText = await response.text();
  const preview = bodyText.trim().replace(/\s+/g, " ").slice(0, 160);

  if (contentType.toLowerCase().includes("text/html") || bodyText.trimStart().startsWith("<")) {
    throw new Error(`AI 服务返回了 HTML 页面，不是 JSON。请检查 Base URL 是否应以 /v1 结尾。响应预览：${preview}`);
  }

  try {
    return JSON.parse(bodyText) as ResponsesPayload;
  } catch {
    throw new Error(`AI 服务返回了无法解析的 JSON。响应预览：${preview}`);
  }
}

function parseResponsesScriptDocument(payload: ResponsesPayload): ScriptDocument {
  const content = payload.output?.flatMap((item) => (item.type === "message" ? item.content ?? [] : [])) ?? [];
  const refusal = content.find((item) => item.type === "refusal")?.refusal;
  if (refusal) {
    throw new Error(`AI 拒绝生成剧本：${refusal}`);
  }

  const text = content.find((item) => item.type === "output_text")?.text;
  if (!text) {
    throw new Error("AI 服务没有返回结构化剧本内容");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI 服务返回了无法解析的 JSON");
  }

  const validation = parseScriptDocumentJson(parsed);
  if (!validation.ok) {
    throw new Error(`AI 返回的剧本文档未通过 Schema 校验：${joinValidationErrors(validation.errors)}`);
  }

  return validation.document;
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
  const promptVariables = buildScriptPromptVariables(input);
  const promptTemplate = await getPromptTemplateByKey("script_generation_chat_yaml");
  const userPrompt = renderPromptTemplate(promptTemplate.userPromptTemplate, promptVariables);
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
          content: promptTemplate.systemPrompt
        },
        {
          role: "user",
          content: userPrompt
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

async function convertWithOpenAIResponses(
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
  const promptVariables = buildScriptPromptVariables(input);
  const promptTemplate = await getPromptTemplateByKey("script_generation_responses_json");
  const userPrompt = renderPromptTemplate(promptTemplate.userPromptTemplate, promptVariables);
  const response = await fetchImpl(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      temperature,
      instructions: promptTemplate.systemPrompt,
      input: userPrompt,
      text: {
        format: {
          type: "json_schema",
          name: "script_document",
          strict: true,
          schema: SCRIPT_DOCUMENT_JSON_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AI 服务请求失败：${response.status}`);
  }

  const payload = await readOpenAIResponsesPayload(response);
  const document = parseResponsesScriptDocument(payload);
  const yaml = scriptDocumentToValidatedYaml(document);

  return {
    yaml,
    report: buildReport("openai-compatible", document)
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
    if (resolveGenerationApi(env) === "responses") {
      return convertWithOpenAIResponses(input, env, fetchImpl, modelConfig);
    }

    return convertWithOpenAICompatible(input, env, fetchImpl, modelConfig);
  }

  throw new Error(`不支持的 AI_PROVIDER：${provider}`);
}
