import type { ProviderName } from "./workspace-context";

export type RuntimeEnvironment = "production" | "development" | "test";

export type BuildConvertModelConfigInput = {
  provider: ProviderName;
  baseUrl: string;
  model: string;
  temperature: number;
  apiKey: string;
  nodeEnv: RuntimeEnvironment;
};

export type ConvertModelConfig =
  | {
      provider: "mock";
    }
  | {
      provider: "openai-compatible";
      baseUrl?: string;
      model?: string;
      temperature: number;
      apiKey?: string;
    };

function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildConvertModelConfig(input: BuildConvertModelConfigInput): ConvertModelConfig {
  if (input.nodeEnv === "production") {
    return {
      provider: "openai-compatible",
      temperature: input.temperature
    };
  }

  if (input.provider === "mock") {
    return { provider: "mock" };
  }

  return {
    provider: "openai-compatible",
    baseUrl: optionalTrimmed(input.baseUrl),
    model: optionalTrimmed(input.model),
    temperature: input.temperature,
    apiKey: optionalTrimmed(input.apiKey)
  };
}
