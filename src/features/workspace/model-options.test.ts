import { describe, expect, test } from "vitest";
import { buildModelOptions } from "./model-options";

describe("model options", () => {
  test("turns fetched model ids into select options", () => {
    expect(buildModelOptions(["gpt-4.1", "gpt-4.1-mini"], "gpt-4.1-mini")).toEqual([
      { value: "gpt-4.1", label: "gpt-4.1" },
      { value: "gpt-4.1-mini", label: "gpt-4.1-mini" }
    ]);
  });

  test("keeps the current manually entered model when it is not in fetched list", () => {
    expect(buildModelOptions(["gpt-4.1"], "custom-model")).toEqual([
      { value: "custom-model", label: "custom-model", description: "当前手动填写" },
      { value: "gpt-4.1", label: "gpt-4.1" }
    ]);
  });

  test("deduplicates and ignores empty model ids", () => {
    expect(buildModelOptions(["gpt-4.1", "", "gpt-4.1"], "gpt-4.1")).toEqual([{ value: "gpt-4.1", label: "gpt-4.1" }]);
  });
});
