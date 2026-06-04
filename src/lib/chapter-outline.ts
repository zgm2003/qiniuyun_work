import type { NovelChapter } from "./chapters";

export type ChapterOutlineItem = {
  index: number;
  title: string;
  bodyCharacterCount: number;
  preview: string;
  isEmpty: boolean;
};

export type ChapterOutline = {
  chapterCount: number;
  minimumChapters: number;
  missingChapterCount: number;
  ready: boolean;
  items: ChapterOutlineItem[];
};

export type ChapterOutlineOptions = {
  minimumChapters?: number;
  previewLength?: number;
};

const DEFAULT_MINIMUM_CHAPTERS = 3;
const DEFAULT_PREVIEW_LENGTH = 60;

function countNonWhitespaceCharacters(value: string): number {
  return value.replace(/\s/g, "").length;
}

function normalizePreviewText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncatePreview(value: string, previewLength: number): string {
  const normalized = normalizePreviewText(value);
  if (normalized.length <= previewLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, previewLength).replace(/[，。！？、,.!?;；:\s]+$/u, "");
  return `${truncated || normalized.slice(0, previewLength)}…`;
}

export function buildChapterOutline(
  chapters: NovelChapter[],
  options: ChapterOutlineOptions = {}
): ChapterOutline {
  const minimumChapters = options.minimumChapters ?? DEFAULT_MINIMUM_CHAPTERS;
  const previewLength = options.previewLength ?? DEFAULT_PREVIEW_LENGTH;
  const chapterCount = chapters.length;
  const missingChapterCount = Math.max(minimumChapters - chapterCount, 0);

  return {
    chapterCount,
    minimumChapters,
    missingChapterCount,
    ready: missingChapterCount === 0,
    items: chapters.map((chapter) => {
      const bodyCharacterCount = countNonWhitespaceCharacters(chapter.body);

      return {
        index: chapter.index,
        title: chapter.title,
        bodyCharacterCount,
        preview: truncatePreview(chapter.body, previewLength),
        isEmpty: bodyCharacterCount === 0
      };
    })
  };
}
