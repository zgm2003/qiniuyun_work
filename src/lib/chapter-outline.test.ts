import { describe, expect, it } from "vitest";
import type { NovelChapter } from "./chapters";
import { buildChapterOutline } from "./chapter-outline";

function chapter(overrides: Partial<NovelChapter> = {}): NovelChapter {
  return {
    index: 1,
    title: "雨夜来信",
    body: "林夏在旧书店收到一封没有署名的信。",
    ...overrides
  };
}

describe("buildChapterOutline", () => {
  it("preserves chapter index and title for preview cards", () => {
    const outline = buildChapterOutline([
      chapter({ index: 1, title: "雨夜来信" }),
      chapter({ index: 2, title: "地铁尽头" })
    ]);

    expect(outline.items.map((item) => ({ index: item.index, title: item.title }))).toEqual([
      { index: 1, title: "雨夜来信" },
      { index: 2, title: "地铁尽头" }
    ]);
  });

  it("counts non-whitespace body characters", () => {
    const outline = buildChapterOutline([chapter({ body: " 林夏 \n 收到 信。 " })]);

    expect(outline.items[0].bodyCharacterCount).toBe(6);
  });

  it("normalizes whitespace and truncates long previews", () => {
    const outline = buildChapterOutline(
      [chapter({ body: "林夏在旧书店收到一封信。\n她发现信纸背面有地图。" })],
      { previewLength: 12 }
    );

    expect(outline.items[0].preview).toBe("林夏在旧书店收到一封信…");
  });

  it("reports how many chapters are still missing", () => {
    const outline = buildChapterOutline([chapter(), chapter({ index: 2 })], { minimumChapters: 3 });

    expect(outline.ready).toBe(false);
    expect(outline.chapterCount).toBe(2);
    expect(outline.missingChapterCount).toBe(1);
  });

  it("marks empty chapter bodies explicitly without inventing preview text", () => {
    const outline = buildChapterOutline([chapter({ body: " \n " })]);

    expect(outline.items[0].isEmpty).toBe(true);
    expect(outline.items[0].preview).toBe("");
    expect(outline.items[0].bodyCharacterCount).toBe(0);
  });
});
