import type { ProviderName } from "./workspace-context";

export type ProductProviderName = Exclude<ProviderName, "mock">;

export type ProductProviderOption = {
  value: ProductProviderName;
  label: string;
  description: string;
};

export const DEFAULT_PRODUCT_PROVIDER: ProductProviderName = "openai-compatible";

export const PRODUCT_PROVIDER_OPTIONS: ProductProviderOption[] = [
  {
    value: "openai-compatible",
    label: "OpenAI Compatible",
    description: "连接真实 OpenAI-compatible Chat Completions API"
  }
];
