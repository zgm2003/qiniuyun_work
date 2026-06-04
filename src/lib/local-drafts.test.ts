import { describe, expect, it } from "vitest";
import type { ConversionReport } from "./mock-converter";
import {
  deleteLocalProjectDraft,
  LOCAL_PROJECT_DRAFTS_STORAGE_KEY,
  readLocalProjectDrafts,
  type DraftStorage,
  type LocalProjectDraft,
  upsertLocalProjectDraft
} from "./local-drafts";

function createMemoryStorage(initialValue?: string): DraftStorage {
  const values = new Map<string, string>();
  if (initialValue !== undefined) {
    values.set(LOCAL_PROJECT_DRAFTS_STORAGE_KEY, initialValue);
  }

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

const report: ConversionReport = {
  provider: "mock",
  chapterCount: 3,
  characterCount: 2,
  sceneCount: 3,
  dialogueLineCount: 3,
  validationPassed: true
};

function draft(overrides: Partial<LocalProjectDraft> = {}): LocalProjectDraft {
  return {
    version: 1,
    id: "draft-1",
    title: "雨夜来信",
    novelText: "第1章 A\n正文\n\n第2章 B\n正文\n\n第3章 C\n正文",
    yamlText: "metadata:\n  title: 雨夜来信",
    report,
    updatedAt: "2026-06-05T01:00:00.000Z",
    ...overrides
  };
}

describe("local project drafts", () => {
  it("reads valid drafts from storage newest first", () => {
    const older = draft({ id: "older", updatedAt: "2026-06-05T01:00:00.000Z" });
    const newer = draft({ id: "newer", updatedAt: "2026-06-05T02:00:00.000Z" });
    const storage = createMemoryStorage(JSON.stringify([older, newer]));

    const drafts = readLocalProjectDrafts(storage);

    expect(drafts.map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("returns an empty list for malformed storage", () => {
    const storage = createMemoryStorage("{not json");

    expect(readLocalProjectDrafts(storage)).toEqual([]);
  });

  it("drops drafts with missing required fields instead of inventing defaults", () => {
    const valid = draft({ id: "valid" });
    const invalid = {
      version: 1,
      id: "invalid",
      title: "缺字段"
    };
    const storage = createMemoryStorage(JSON.stringify([invalid, valid]));

    expect(readLocalProjectDrafts(storage).map((item) => item.id)).toEqual(["valid"]);
  });

  it("upserts by id instead of duplicating drafts", () => {
    const storage = createMemoryStorage(JSON.stringify([draft({ title: "旧标题" })]));

    const drafts = upsertLocalProjectDraft(storage, draft({ title: "新标题" }));

    expect(drafts).toHaveLength(1);
    expect(drafts[0].title).toBe("新标题");
    expect(JSON.parse(storage.getItem(LOCAL_PROJECT_DRAFTS_STORAGE_KEY) ?? "[]")).toHaveLength(1);
  });

  it("deletes one draft without touching the others", () => {
    const keep = draft({ id: "keep" });
    const remove = draft({ id: "remove" });
    const storage = createMemoryStorage(JSON.stringify([keep, remove]));

    const drafts = deleteLocalProjectDraft(storage, "remove");

    expect(drafts.map((item) => item.id)).toEqual(["keep"]);
  });

  it("preserves yaml text and conversion report", () => {
    const storage = createMemoryStorage();
    const saved = draft({
      yamlText: "metadata:\n  title: 保存后的 YAML",
      report: { ...report, sceneCount: 8 }
    });

    upsertLocalProjectDraft(storage, saved);

    expect(readLocalProjectDrafts(storage)[0].yamlText).toBe("metadata:\n  title: 保存后的 YAML");
    expect(readLocalProjectDrafts(storage)[0].report?.sceneCount).toBe(8);
  });
});
