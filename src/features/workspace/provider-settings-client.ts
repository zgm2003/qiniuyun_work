import type { ProductProviderName } from "./provider-options";

type FetchImplementation = typeof fetch;

export type SaveProviderSettingsInput = {
  provider: ProductProviderName;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

type SavedProvider = {
  id: string;
  hasApiKey: boolean;
};

type ProviderSettingsSuccess = {
  provider: SavedProvider;
};

type ProviderSettingsFailure = {
  error: string;
};

function isProviderSettingsFailure(value: ProviderSettingsSuccess | ProviderSettingsFailure): value is ProviderSettingsFailure {
  return "error" in value;
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
