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

  it("defines dark theme tokens and animated theme-transition hooks", () => {
    expect(css).toContain("html.dark");
    expect(css).toContain(".theme-toggle-button");
    expect(css).toContain("::view-transition-new(root)");
  });

  it("hides scrollbars globally without disabling scrolling", () => {
    expect(css).toContain("scrollbar-width: none;");
    expect(css).toContain("-ms-overflow-style: none;");
    expect(css).toContain("::-webkit-scrollbar");
    expect(css).not.toContain("scrollbar-width: thin;");
    expect(css).not.toContain("overflow: hidden; /* global scrollbar hide */");
  });

  it("keeps desktop workbench navigation centered in the viewport", () => {
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);");
    expect(css).toContain(".top-nav nav {\n  justify-self: center;");
    expect(css).toContain(".top-nav-actions {\n  justify-self: end;");
  });

  it("styles visible persistence UI hooks", () => {
    expect(css).toContain(".project-persistence-card");
    expect(css).toContain(".project-save-button");
    expect(css).toContain(".generation-run-line");
    expect(css).toContain("html.dark .project-persistence-card");
    expect(css).toContain(".project-persistence-card > p");
    expect(css).toContain(".project-persistence-card .section-kicker");
  });
});
