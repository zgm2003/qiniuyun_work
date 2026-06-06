import type { ServerGenerationRunSummary } from "./server-projects-client";

const STATUS_LABELS: Record<ServerGenerationRunSummary["status"], string> = {
  running: "生成中",
  succeeded: "成功",
  failed: "失败"
};

export function getGenerationRunTone(status: ServerGenerationRunSummary["status"]): "neutral" | "ok" | "bad" {
  if (status === "succeeded") {
    return "ok";
  }
  if (status === "failed") {
    return "bad";
  }
  return "neutral";
}

export function formatGenerationRunSummary(run: ServerGenerationRunSummary): string {
  const base = `${STATUS_LABELS[run.status]} · ${run.model} · ${new Date(run.createdAt).toLocaleString("zh-CN")}`;
  if (run.errorMessage) {
    return `${base} · ${run.errorMessage}`;
  }

  return base;
}
