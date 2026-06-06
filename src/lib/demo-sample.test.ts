import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseNovelChapters } from "./chapters";
import { SAMPLE_NOVEL } from "./demo-sample";

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function nonWhitespaceLength(value: string): number {
  return value.replace(/\s/g, "").length;
}

describe("demo novel sample", () => {
  it("keeps the built-in sample and txt/md sample files in sync", () => {
    const sample = normalizeText(SAMPLE_NOVEL);
    const txt = normalizeText(readFileSync(join(process.cwd(), "samples/novel-3chapters.txt"), "utf8"));
    const md = normalizeText(readFileSync(join(process.cwd(), "samples/novel-3chapters.md"), "utf8"));

    expect(txt).toBe(sample);
    expect(md).toBe(sample);
  });

  it("uses a substantial multi-chapter novel instead of a tiny placeholder", () => {
    const chapters = parseNovelChapters(SAMPLE_NOVEL);

    expect(chapters.length).toBeGreaterThanOrEqual(5);
    expect(nonWhitespaceLength(SAMPLE_NOVEL)).toBeGreaterThan(1800);
  });
});
