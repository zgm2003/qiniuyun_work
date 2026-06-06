type FetchImplementation = typeof fetch;

export type SaveProviderSettingsInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type SavedProvider = {
  id: string;
  hasApiKey: boolean;
  model?: string;
};

export type LoadedProviderSettings = {
  id: string;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
};

type ProviderSettingsSuccess = {
  provider: SavedProvider;
};

type LoadProviderSettingsSuccess = {
  provider: (LoadedProviderSettings & { provider?: "openai-compatible" }) | null;
};

type ProviderSettingsFailure = {
  error: string;
};

function isProviderSettingsFailure(
  value: ProviderSettingsSuccess | LoadProviderSettingsSuccess | ProviderSettingsFailure
): value is ProviderSettingsFailure {
  return "error" in value;
}

export async function loadProviderSettings(fetchImpl: FetchImplementation = fetch): Promise<LoadedProviderSettings | null> {
  const response = await fetchImpl("/api/provider-settings", { method: "GET" });
  const body = (await response.json()) as LoadProviderSettingsSuccess | ProviderSettingsFailure;

  if (!response.ok || isProviderSettingsFailure(body)) {
    throw new Error(isProviderSettingsFailure(body) ? body.error : "AI 配置读取失败");
  }

  if (!body.provider) {
    return null;
  }

  return {
    id: body.provider.id,
    baseUrl: body.provider.baseUrl,
    model: body.provider.model,
    hasApiKey: body.provider.hasApiKey
  };
}

export async function saveProviderSettings(
  input: SaveProviderSettingsInput,
  fetchImpl: FetchImplementation = fetch
): Promise<SavedProvider> {
  const response = await fetchImpl("/api/provider-settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = (await response.json()) as ProviderSettingsSuccess | ProviderSettingsFailure;

  if (!response.ok || isProviderSettingsFailure(body)) {
    throw new Error(isProviderSettingsFailure(body) ? body.error : "AI 配置保存失败");
  }

  return {
    id: body.provider.id,
    hasApiKey: body.provider.hasApiKey,
    model: body.provider.model
  };
}
