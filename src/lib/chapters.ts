export type NovelChapter = {
  index: number;
  title: string;
  body: string;
};

type ChapterHeading = {
  index: number;
  title: string;
};

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

function parseChineseNumber(value: string): number {
  if (value.includes("十")) {
    const [tensRaw, onesRaw] = value.split("十");
    const tens = tensRaw === "" ? 1 : CHINESE_DIGITS[tensRaw];
    const ones = onesRaw === "" ? 0 : CHINESE_DIGITS[onesRaw];

    if (tens === undefined || ones === undefined) {
      throw new Error(`无法识别章节编号：${value}`);
    }

    return tens * 10 + ones;
  }

  const digit = CHINESE_DIGITS[value];
  if (digit === undefined) {
    throw new Error(`无法识别章节编号：${value}`);
  }

  return digit;
}

function parseChapterIndex(value: string): number {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  return parseChineseNumber(value);
}

function parseHeading(line: string): ChapterHeading | null {
  const chinese = line.match(/^第\s*([\d一二两三四五六七八九十零〇]+)\s*[章节回]\s*[:：、.\-—\s]*(.*)$/);
  if (chinese) {
    const index = parseChapterIndex(chinese[1]);
    return {
      index,
      title: chinese[2].trim() || `第${index}章`
    };
  }

  const english = line.match(/^Chapter\s+(\d+)\s*[:：\-—\s]*(.*)$/i);
  if (english) {
    const index = Number(english[1]);
    return {
      index,
      title: english[2].trim() || `Chapter ${index}`
    };
  }

  return null;
}

export function parseNovelChapters(input: string): NovelChapter[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const chapters: NovelChapter[] = [];
  let current: { heading: ChapterHeading; body: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = parseHeading(line);

    if (heading) {
      if (current) {
        chapters.push({
          index: current.heading.index,
          title: current.heading.title,
          body: current.body.join("\n").trim()
        });
      }

      current = { heading, body: [] };
      continue;
    }

    if (current) {
      current.body.push(rawLine);
    }
  }

  if (current) {
    chapters.push({
      index: current.heading.index,
      title: current.heading.title,
      body: current.body.join("\n").trim()
    });
  }

  const nonEmptyChapters = chapters.filter((chapter) => chapter.body.length > 0);
  if (nonEmptyChapters.length > 0) {
    return nonEmptyChapters;
  }

  const body = input.trim();
  return body.length > 0 ? [{ index: 1, title: "全文", body }] : [];
}

export function requireMinimumChapters(chapters: NovelChapter[], minimum: number): void {
  if (chapters.length < minimum) {
    throw new Error(`至少需要 ${minimum} 个章节，当前只有 ${chapters.length} 个章节`);
  }
}
