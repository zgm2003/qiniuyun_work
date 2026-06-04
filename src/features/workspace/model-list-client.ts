import type { ProviderName } from "./workspace-context";

type FetchImplementation = typeof fetch;

type FetchProviderModelsInput = {
  provider: ProviderName;
  apiKey: string;
  baseUrl: string;
};

type ModelsSuccess = {
  models: string[];
};

type ModelsFailure = {
  error: string;
};

function isModelsFailure(value: ModelsSuccess | ModelsFailure): value is ModelsFailure {
  return "error" in value;
}

export async function fetchProviderModels(input: FetchProviderModelsInput, fetchImpl: FetchImplementation = fetch): Promise<string[]> {
  const response = await fetchImpl("/api/models", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = (await response.json()) as ModelsSuccess | ModelsFailure;

  if (!response.ok || isModelsFailure(body)) {
    throw new Error(isModelsFailure(body) ? body.error : "获取模型列表失败");
  }

  if (!Array.isArray(body.models) || body.models.some((modelId) => typeof modelId !== "string")) {
    throw new Error("模型列表响应格式错误");
  }

  return body.models;
}
