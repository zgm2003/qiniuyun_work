import { describe, expect, it } from "vitest";
import { claimServerProjectSaveLock, releaseServerProjectSaveLock } from "./workspace-context";

describe("server project save lock", () => {
  it("rejects a second synchronous save before the first save releases the lock", () => {
    const lock = { current: false };

    expect(claimServerProjectSaveLock(lock)).toBe(true);
    expect(claimServerProjectSaveLock(lock)).toBe(false);

    releaseServerProjectSaveLock(lock);
    expect(claimServerProjectSaveLock(lock)).toBe(true);
  });
});
