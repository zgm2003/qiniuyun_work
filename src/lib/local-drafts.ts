import type { ConversionReport } from "./mock-converter";

export const LOCAL_PROJECT_DRAFTS_STORAGE_KEY = "novel-to-script-ai.local-project-drafts.v1";

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type LocalProjectDraft = {
  version: 1;
  id: string;
  title: string;
  novelText: string;
  yamlText: string;
  report: ConversionReport | null;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidProvider(value: unknown): value is ConversionReport["provider"] {
  return value === "mock" || value === "openai-compatible";
}

function isValidReport(value: unknown): value is ConversionReport | null {
  if (value === null) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return (
    isValidProvider(value.provider) &&
    typeof value.chapterCount === "number" &&
    typeof value.characterCount === "number" &&
    typeof value.sceneCount === "number" &&
    typeof value.dialogueLineCount === "number" &&
    typeof value.validationPassed === "boolean"
  );
}

function isLocalProjectDraft(value: unknown): value is LocalProjectDraft {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 1 &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    typeof value.novelText === "string" &&
    typeof value.yamlText === "string" &&
    isValidReport(value.report) &&
    typeof value.updatedAt === "string" &&
    value.updatedAt.length > 0
  );
}

function sortDraftsByUpdatedAt(drafts: LocalProjectDraft[]): LocalProjectDraft[] {
  return [...drafts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function writeLocalProjectDrafts(storage: DraftStorage, drafts: LocalProjectDraft[]): LocalProjectDraft[] {
  const sortedDrafts = sortDraftsByUpdatedAt(drafts);
  storage.setItem(LOCAL_PROJECT_DRAFTS_STORAGE_KEY, JSON.stringify(sortedDrafts));
  return sortedDrafts;
}

export function readLocalProjectDrafts(storage: DraftStorage): LocalProjectDraft[] {
  const raw = storage.getItem(LOCAL_PROJECT_DRAFTS_STORAGE_KEY);
  if (raw === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortDraftsByUpdatedAt(parsed.filter(isLocalProjectDraft));
  } catch {
    return [];
  }
}

export function upsertLocalProjectDraft(storage: DraftStorage, draft: LocalProjectDraft): LocalProjectDraft[] {
  if (!isLocalProjectDraft(draft)) {
    throw new Error("本地草稿数据结构不合法");
  }

  const drafts = readLocalProjectDrafts(storage).filter((item) => item.id !== draft.id);
  return writeLocalProjectDrafts(storage, [draft, ...drafts]);
}

export function deleteLocalProjectDraft(storage: DraftStorage, draftId: string): LocalProjectDraft[] {
  const drafts = readLocalProjectDrafts(storage).filter((item) => item.id !== draftId);
  return writeLocalProjectDrafts(storage, drafts);
}
