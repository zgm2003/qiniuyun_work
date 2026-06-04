import { describe, expect, it } from "vitest";
import { MAX_NOVEL_TEXT_IMPORT_BYTES, prepareNovelTextImport } from "./file-import";

describe("prepareNovelTextImport", () => {
  it("accepts txt files and derives the editor title from the filename", () => {
    const result = prepareNovelTextImport({
      fileName: "雨夜来信.txt",
      size: 128,
      text: "第1章 雨夜来信\n林夏收到一封信。"
    });

    expect(result).toEqual({
      title: "雨夜来信",
      text: "第1章 雨夜来信\n林夏收到一封信。",
      fileName: "雨夜来信.txt",
      extension: ".txt"
    });
  });

  it("accepts markdown files with uppercase extensions", () => {
    const result = prepareNovelTextImport({
      fileName: "outline.MD",
      size: 128,
      text: "第1章 开端\n正文。"
    });

    expect(result.title).toBe("outline");
    expect(result.extension).toBe(".md");
  });

  it("rejects unsupported file extensions instead of guessing formats", () => {
    expect(() =>
      prepareNovelTextImport({
        fileName: "novel.docx",
        size: 128,
        text: "第1章 开端\n正文。"
      })
    ).toThrow("仅支持导入 .txt 或 .md 文本文件");
  });

  it("rejects files larger than the import size limit", () => {
    expect(() =>
      prepareNovelTextImport({
        fileName: "novel.txt",
        size: MAX_NOVEL_TEXT_IMPORT_BYTES + 1,
        text: "第1章 开端\n正文。"
      })
    ).toThrow("文件不能超过 512KB");
  });

  it("rejects blank file content", () => {
    expect(() =>
      prepareNovelTextImport({
        fileName: "blank.txt",
        size: 8,
        text: " \n\t "
      })
    ).toThrow("导入文件内容不能为空");
  });

  it("rejects filenames without a usable title", () => {
    expect(() =>
      prepareNovelTextImport({
        fileName: ".txt",
        size: 8,
        text: "第1章 开端\n正文。"
      })
    ).toThrow("文件名不能作为标题");
  });
});
