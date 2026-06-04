export const MAX_NOVEL_TEXT_IMPORT_BYTES = 512 * 1024;

const SUPPORTED_EXTENSIONS = new Set([".txt", ".md"]);

export type NovelTextImportInput = {
  fileName: string;
  size: number;
  text: string;
};

export type NovelTextImportResult = {
  title: string;
  text: string;
  fileName: string;
  extension: ".txt" | ".md";
};

function extractExtension(fileName: string): ".txt" | ".md" {
  const normalizedName = fileName.trim();
  const dotIndex = normalizedName.lastIndexOf(".");
  const extension = dotIndex >= 0 ? normalizedName.slice(dotIndex).toLowerCase() : "";

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("仅支持导入 .txt 或 .md 文本文件");
  }

  return extension as ".txt" | ".md";
}

function deriveTitle(fileName: string, extension: ".txt" | ".md"): string {
  const title = fileName.trim().slice(0, -extension.length).trim();
  if (!title) {
    throw new Error("文件名不能作为标题");
  }

  return title;
}

export function prepareNovelTextImport(input: NovelTextImportInput): NovelTextImportResult {
  const extension = extractExtension(input.fileName);

  if (input.size > MAX_NOVEL_TEXT_IMPORT_BYTES) {
    throw new Error("文件不能超过 512KB");
  }

  if (!input.text.trim()) {
    throw new Error("导入文件内容不能为空");
  }

  return {
    title: deriveTitle(input.fileName, extension),
    text: input.text,
    fileName: input.fileName,
    extension
  };
}
