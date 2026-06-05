import { describe, expect, test } from "vitest";
import { buildConvertModelConfig } from "./model-request-config";

describe("buildConvertModelConfig", () => {
  test("keeps development mock requests minimal", () => {
    expect(
      buildConvertModelConfig({
        provider: "mock",
        baseUrl: "https://api.example.test/v1",
        model: "ignored-model",
        temperature: 0.7,
        apiKey: "ignored-key",
        nodeEnv: "development"
      })
    ).toEqual({ provider: "mock" });
  });

  test("keeps development openai-compatible request fields and turns empty strings into undefined", () => {
    expect(
      buildConvertModelConfig({
        provider: "openai-compatible",
        baseUrl: "  ",
        model: " gpt-4.1-mini ",
        temperature: 0.2,
        apiKey: "",
        nodeEnv: "development"
      })
    ).toEqual({
      provider: "openai-compatible",
      baseUrl: undefined,
      model: "gpt-4.1-mini",
      temperature: 0.2,
      apiKey: undefined
    });
  });

  test("never sends browser credentials or endpoint details in production", () => {
    expect(
      buildConvertModelConfig({
        provider: "mock",
        baseUrl: "https://api.example.test/v1",
        model: "gpt-4.1",
        temperature: 0.1,
        apiKey: "secret-key",
        nodeEnv: "production"
      })
    ).toEqual({
      provider: "openai-compatible",
      temperature: 0.1
    });
  });

  test("treats test like development for local request construction", () => {
    expect(
      buildConvertModelConfig({
        provider: "openai-compatible",
        baseUrl: " https://api.example.test/v1 ",
        model: " custom-model ",
        temperature: 0.3,
        apiKey: " test-key ",
        nodeEnv: "test"
      })
    ).toEqual({
      provider: "openai-compatible",
      baseUrl: "https://api.example.test/v1",
      model: "custom-model",
      temperature: 0.3,
      apiKey: "test-key"
    });
  });
});
