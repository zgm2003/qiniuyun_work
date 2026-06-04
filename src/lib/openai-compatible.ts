export type FetchImplementation = typeof fetch;

export type ListModelsInput = {
  apiKey: string;
  baseUrl?: string;
};

type ModelsPayload = {
  data?: Array<{ id?: unknown }>;
};

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export function normalizeOpenAIBaseUrl(rawBaseUrl: string): string {
  const baseUrl = rawBaseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return DEFAULT_OPENAI_BASE_URL;
  }

  if (/\/v\d+$/i.test(baseUrl)) {
    return baseUrl;
  }

  return `${baseUrl}/v1`;
}

async function readModelsPayload(response: Response): Promise<ModelsPayload> {
  const bodyText = await response.text();
  const preview = bodyText.trim().replace(/\s+/g, " ").slice(0, 160);

  if (bodyText.trimStart().startsWith("<")) {
    throw new Error(`模型列表接口返回了 HTML 页面，不是 JSON。请检查 Base URL 是否应以 /v1 结尾。响应预览：${preview}`);
  }

  if (!response.ok) {
    throw new Error(`模型列表接口请求失败：${response.status}。响应预览：${preview}`);
  }

  try {
    return JSON.parse(bodyText) as ModelsPayload;
  } catch {
    throw new Error(`模型列表接口返回了无法解析的 JSON。响应预览：${preview}`);
  }
}

export async function listOpenAICompatibleModels(input: ListModelsInput, fetchImpl: FetchImplementation = fetch): Promise<string[]> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error("API Key 不能为空");
  }

  const baseUrl = normalizeOpenAIBaseUrl(input.baseUrl ?? DEFAULT_OPENAI_BASE_URL);
  const response = await fetchImpl(`${baseUrl}/models`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${apiKey}`
    }
  });

  const payload = await readModelsPayload(response);
  if (!Array.isArray(payload.data)) {
    throw new Error("模型列表接口返回格式错误：data 必须是数组");
  }

  const modelIds = new Set<string>();
  for (const model of payload.data) {
    if (typeof model.id !== "string" || !model.id.trim()) {
      throw new Error("模型列表接口返回格式错误：data[].id 必须是字符串");
    }
    modelIds.add(model.id);
  }

  return Array.from(modelIds).sort((left, right) => left.localeCompare(right));
}
