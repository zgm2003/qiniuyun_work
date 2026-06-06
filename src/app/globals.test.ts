import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("global CSS guardrails", () => {
  it("keeps long custom select lists scrollable inside dialogs", () => {
    expect(css).toContain(".ui-select-popover");
    expect(css).toContain("max-height:");
    expect(css).toContain("overflow-y: auto;");
  });
});
