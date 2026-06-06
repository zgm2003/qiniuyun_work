import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { UiButton } from "./button";
import { UiDialog } from "./dialog";
import { UiSelect } from "./select";

const providerOptions = [
  {
    value: "openai-compatible",
    label: "OpenAI Compatible",
    description: "连接真实 OpenAI-compatible API"
  }
];

describe("shared UI controls", () => {
  test("maps button variants to stable design-system classes", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(UiButton, { variant: "primary" }, "生成"),
        createElement(UiButton, { variant: "secondary" }, "保存"),
        createElement(UiButton, { variant: "danger" }, "删除")
      )
    );

    expect(markup).toContain("primary-button");
    expect(markup).toContain("secondary-button");
    expect(markup).toContain("danger-button");
  });

  test("renders select as a styled listbox instead of a native browser select", () => {
    const markup = renderToStaticMarkup(
      createElement(UiSelect, {
        label: "Provider",
        value: "openai-compatible",
        options: providerOptions,
        onChange: () => undefined,
        defaultOpen: true
      })
    );

    expect(markup).not.toContain("<select");
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain("OpenAI Compatible");
  });


  test("keeps an accessible select label when the visual label is hidden", () => {
    const markup = renderToStaticMarkup(
      createElement(UiSelect, {
        label: "Model",
        value: "gpt-4.1-mini",
        options: [{ value: "gpt-4.1-mini", label: "gpt-4.1-mini" }],
        onChange: () => undefined,
        hideLabel: true
      })
    );

    expect(markup).toContain('class="visually-hidden"');
    expect(markup).toContain("Model");
  });

  test("renders dialog content only when open", () => {
    const closed = renderToStaticMarkup(
      createElement(
        UiDialog,
        {
          open: false,
          title: "模型设置",
          onClose: () => undefined
        },
        "Dialog body"
      )
    );
    const open = renderToStaticMarkup(
      createElement(
        UiDialog,
        {
          open: true,
          title: "模型设置",
          onClose: () => undefined
        },
        "Dialog body"
      )
    );

    expect(closed).toBe("");
    expect(open).toContain('role="dialog"');
    expect(open).toContain("模型设置");
    expect(open).toContain("Dialog body");
  });
});

describe("shared UI control CSS", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

  function cssBlock(selector: string): string {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(css);
    if (!match) {
      throw new Error(`${selector} CSS block is missing`);
    }

    return match[1];
  }

  function cssBlocks(selector: string): string[] {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return Array.from(css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")), (match) => match[1]);
  }

  test("centers the dialog close button content", () => {
    const closeButton = cssBlock(".ui-dialog-close");
    const closeButtonOverride = cssBlock(".ghost-button.ui-dialog-close");

    expect(closeButton).toContain("display: grid");
    expect(closeButton).toContain("place-items: center");
    expect(closeButtonOverride).toContain("padding: 0");
  });

  test("uses one shared height for select triggers and compact inputs", () => {
    const root = cssBlock(":root");
    const selectTrigger = cssBlock(".ui-select-trigger");
    const compactInputBlocks = cssBlocks(".compact-input");

    expect(root).toContain("--model-control-height: 56px");
    expect(selectTrigger).toContain("height: var(--model-control-height)");
    expect(selectTrigger).not.toContain("min-height: 42px");
    expect(compactInputBlocks.some((block) => block.includes("height: var(--model-control-height)"))).toBe(true);
  });
});
