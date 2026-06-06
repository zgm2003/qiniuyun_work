import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

const createPortalMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("react-dom", () => ({
  createPortal: createPortalMock
}));

describe("UiDialog portal behavior", () => {
  afterEach(() => {
    createPortalMock.mockClear();
    vi.unstubAllGlobals();
  });

  test("renders open dialogs through document.body instead of inside the header", async () => {
    const body = { nodeName: "BODY" };
    vi.stubGlobal("document", { body });

    const { UiDialog } = await import("./dialog");
    const markup = renderToStaticMarkup(
      createElement(
        "header",
        { className: "top-nav" },
        createElement(
          UiDialog,
          {
            open: true,
            title: "模型设置",
            onClose: () => undefined
          },
          "Dialog body"
        )
      )
    );

    expect(createPortalMock).toHaveBeenCalledTimes(1);
    expect(createPortalMock.mock.calls[0][1]).toBe(body);
    expect(markup).not.toContain("Dialog body");
  });
});
