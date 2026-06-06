import type { ConversionReport } from "@/lib/mock-converter";

export type ServerProjectListItem = {
  id: string;
  title: string;
  status: "draft" | "generated" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type ServerScriptVersion = {
  yaml: string;
  report: ConversionReport;
};

export type ServerProjectDetail = ServerProjectListItem & {
  sourceText: string;
  latestVersion: ServerScriptVersion | null;
};

type ApiFailure = {
  error: string;
};

function isApiFailure(value: unknown): value is ApiFailure {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error: unknown }).error === "string";
}

async function readJson<T>(response: Response, fallbackMessage = "请求失败"): Promise<T> {
  const body = (await response.json()) as T | ApiFailure;
  if (!response.ok || isApiFailure(body)) {
    throw new Error(isApiFailure(body) ? body.error : fallbackMessage);
  }

  return body;
}

export async function listServerProjects(): Promise<ServerProjectListItem[]> {
  const body = await readJson<{ projects: ServerProjectListItem[] }>(await fetch("/api/projects", { cache: "no-store" }));
  return body.projects;
}

export async function loadServerProject(projectId: string): Promise<ServerProjectDetail> {
  const body = await readJson<{ project: ServerProjectDetail }>(await fetch(`/api/projects/${projectId}`, { cache: "no-store" }));
  return body.project;
}

export async function createServerProject(title: string, sourceText: string): Promise<ServerProjectDetail> {
  const body = await readJson<{ project: ServerProjectDetail }>(
    await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, sourceText })
    })
  );
  return body.project;
}

export async function updateServerProject(projectId: string, title: string, sourceText: string): Promise<ServerProjectDetail> {
  const body = await readJson<{ project: ServerProjectDetail }>(
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, sourceText })
    })
  );
  return body.project;
}

export async function saveServerScriptVersion(projectId: string, yaml: string, report: ConversionReport): Promise<void> {
  await readJson(
    await fetch(`/api/projects/${projectId}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ yaml, report })
    })
  );
}
