import { describe, expect, test } from "vitest";
import { getActiveWorkbenchRoute, WORKBENCH_NAV_ITEMS } from "./workbench-nav";

describe("workbench nav", () => {
  test("defines the product workbench routes in display order", () => {
    expect(WORKBENCH_NAV_ITEMS.map((item) => item.href)).toEqual(["/workspace", "/projects", "/script"]);
    expect(WORKBENCH_NAV_ITEMS.find((item) => item.href === "/projects")?.description).toContain("MySQL");
  });

  test("uses workspace as the default active route", () => {
    expect(getActiveWorkbenchRoute("/")).toBe("/workspace");
    expect(getActiveWorkbenchRoute("/unknown")).toBe("/workspace");
  });

  test("matches nested paths to their route root", () => {
    expect(getActiveWorkbenchRoute("/script/review")).toBe("/script");
    expect(getActiveWorkbenchRoute("/projects/project-1")).toBe("/projects");
  });
});
