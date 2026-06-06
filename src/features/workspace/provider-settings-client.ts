import type { ProductProviderName } from "./provider-options";

type FetchImplementation = typeof fetch;

export type SaveProviderSettingsInput = {
  provider: ProductProviderName;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type SavedProvider = {
  id: string;
  hasApiKey: boolean;
};

export type LoadedProviderSettings = {
  id: string;
  provider: ProductProviderName;
  name: string;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
};

type ProviderSettingsSuccess = {
  provider: SavedProvider;
};

type LoadProviderSettingsSuccess = {
  provider: LoadedProviderSettings | null;
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
    throw new Error(isProviderSettingsFailure(body) ? body.error : "AI provider 读取失败");
  }

  return body.provider;
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
    throw new Error(isProviderSettingsFailure(body) ? body.error : "AI provider 保存失败");
  }

  return body.provider;
}
