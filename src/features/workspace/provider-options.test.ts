import { describe, expect, test } from "vitest";
import { DEFAULT_PRODUCT_MODEL, DEFAULT_PRODUCT_PROVIDER } from "./provider-options";

describe("product provider defaults", () => {
  test("uses the only real runtime provider", () => {
    expect(DEFAULT_PRODUCT_PROVIDER).toBe("openai-compatible");
  });

  test("uses the current target production model as the workspace default", () => {
    expect(DEFAULT_PRODUCT_MODEL).toBe("gpt-5.5");
  });
});
