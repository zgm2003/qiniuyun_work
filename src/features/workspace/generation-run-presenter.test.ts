import { describe, expect, it } from "vitest";
import { formatGenerationRunSummary, getGenerationRunTone } from "./generation-run-presenter";

const succeededRun = {
  id: "run-1",
  projectId: "project-1",
  provider: "openai-compatible" as const,
  model: "cheap-model",
  status: "succeeded" as const,
  errorMessage: null,
  createdAt: "2026-06-05T02:10:00.000Z"
};

describe("generation run presenter", () => {
  it("formats a succeeded generation run", () => {
    expect(formatGenerationRunSummary(succeededRun)).toContain("成功 · cheap-model");
    expect(getGenerationRunTone(succeededRun.status)).toBe("ok");
  });

  it("formats a failed generation run with its error", () => {
    const failedRun = { ...succeededRun, status: "failed" as const, errorMessage: "AI 服务请求失败：500" };

    expect(formatGenerationRunSummary(failedRun)).toContain("失败 · cheap-model");
    expect(formatGenerationRunSummary(failedRun)).toContain("AI 服务请求失败：500");
    expect(getGenerationRunTone(failedRun.status)).toBe("bad");
  });

  it("formats a running generation run", () => {
    const runningRun = { ...succeededRun, status: "running" as const };

    expect(formatGenerationRunSummary(runningRun)).toContain("生成中 · cheap-model");
    expect(getGenerationRunTone(runningRun.status)).toBe("neutral");
  });
});
