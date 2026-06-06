import { describe, expect, test } from "vitest";
import { buildModelOptions } from "./model-options";

describe("buildModelOptions", () => {
  test("keeps fetched model ids sorted for model selection", () => {
    expect(buildModelOptions(["gpt-balanced", "gpt-cheap"], "gpt-cheap")).toEqual([
      { value: "gpt-balanced", label: "gpt-balanced" },
      { value: "gpt-cheap", label: "gpt-cheap" }
    ]);
  });

  test("keeps the current custom model visible when it is not returned by /models", () => {
    expect(buildModelOptions(["gpt-cheap"], "custom-model")).toEqual([
      { value: "custom-model", label: "custom-model" },
      { value: "gpt-cheap", label: "gpt-cheap" }
    ]);
  });

  test("removes blank and duplicate model ids", () => {
    expect(buildModelOptions(["gpt-cheap", "", "gpt-cheap"], "gpt-cheap")).toEqual([
      { value: "gpt-cheap", label: "gpt-cheap" }
    ]);
  });
});
