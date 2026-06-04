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
