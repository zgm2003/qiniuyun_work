import { describe, expect, it } from "vitest";
import { parseNovelChapters, requireMinimumChapters } from "./chapters";

const threeChapterNovel = `第1章 雨夜来信
林夏在旧书店收到一封没有署名的信。

第2章 地铁尽头
她按照信里的地址来到最后一班地铁。

第3章 天台对峙
真相在天台被揭开。`;

describe("parseNovelChapters", () => {
  it("splits Chinese chapter headings and preserves chapter bodies", () => {
    const chapters = parseNovelChapters(threeChapterNovel);

    expect(chapters).toEqual([
      {
        index: 1,
        title: "雨夜来信",
        body: "林夏在旧书店收到一封没有署名的信。"
      },
      {
        index: 2,
        title: "地铁尽头",
        body: "她按照信里的地址来到最后一班地铁。"
      },
      {
        index: 3,
        title: "天台对峙",
        body: "真相在天台被揭开。"
      }
    ]);
  });

  it("supports English chapter headings used by translated novels", () => {
    const chapters = parseNovelChapters(`Chapter 1: Arrival
Mara enters the lab.

Chapter 2 - Conflict
The server starts lying.

Chapter 3 Resolution
She cuts the power.`);

    expect(chapters.map((chapter) => chapter.title)).toEqual([
      "Arrival",
      "Conflict",
      "Resolution"
    ]);
  });
});

describe("requireMinimumChapters", () => {
  it("rejects novels with fewer than three chapters", () => {
    const chapters = parseNovelChapters(`第1章 开端
只有一章。`);

    expect(() => requireMinimumChapters(chapters, 3)).toThrow(
      "至少需要 3 个章节，当前只有 1 个章节"
    );
  });
});
