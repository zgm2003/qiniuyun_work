import { describe, expect, test } from "vitest";
import { DEFAULT_PRODUCT_MODEL, DEFAULT_PRODUCT_PROVIDER, PRODUCT_PROVIDER_OPTIONS } from "./provider-options";

describe("product provider options", () => {
  test("uses a real provider as the product default", () => {
    expect(DEFAULT_PRODUCT_PROVIDER).toBe("openai-compatible");
  });

  test("uses the current target production model as the workspace default", () => {
    expect(DEFAULT_PRODUCT_MODEL).toBe("gpt-5.5");
  });

  test("does not expose mock as a selectable product provider", () => {
    expect(PRODUCT_PROVIDER_OPTIONS.map((option) => option.value)).toEqual(["openai-compatible"]);
  });
});
