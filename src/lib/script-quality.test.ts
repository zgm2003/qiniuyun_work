import { describe, expect, it } from "vitest";
import { convertNovelToScript } from "./mock-converter";
import { buildScriptQualityChecklist } from "./script-quality";
import { validateScriptYaml, type ScriptValidationResult } from "./script-schema";

const novel = `第1章 雨夜来信
林夏在旧书店收到一封没有署名的信。

第2章 地铁尽头
林夏带着信来到末班地铁。陈默出现。

第3章 天台对峙
林夏和陈默在天台对峙。`;

function validValidation(): ScriptValidationResult {
  return validateScriptYaml(convertNovelToScript({ title: "雨夜来信", text: novel }).yaml);
}

function checkStatus(validation: ScriptValidationResult | null, id: string) {
  const checklist = buildScriptQualityChecklist(validation);
  const item = checklist.items.find((check) => check.id === id);
  if (!item) {
    throw new Error(`missing checklist item: ${id}`);
  }

  return item.status;
}

describe("buildScriptQualityChecklist", () => {
  it("returns pending checks before YAML exists", () => {
    const checklist = buildScriptQualityChecklist(null);

    expect(checklist.status).toBe("pending");
    expect(checklist.items.every((item) => item.status === "pending")).toBe(true);
  });

  it("passes every structural check for valid generated YAML", () => {
    const checklist = buildScriptQualityChecklist(validValidation());

    expect(checklist.status).toBe("pass");
    expect(checklist.failedCount).toBe(0);
    expect(checklist.items.map((item) => item.status)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
      "pass",
      "pass",
      "pass"
    ]);
  });

  it("fails the schema check for invalid YAML syntax", () => {
    const validation = validateScriptYaml("metadata:\n  title: [");
    const checklist = buildScriptQualityChecklist(validation);

    expect(checklist.status).toBe("fail");
    expect(checkStatus(validation, "schema")).toBe("fail");
    expect(checkStatus(validation, "metadata")).toBe("pending");
  });

  it("maps missing metadata fields to the metadata check", () => {
    const validation = validateScriptYaml(`metadata:
  title: 雨夜来信
characters: []
scenes: []
summary: {}`);

    expect(checkStatus(validation, "metadata")).toBe("fail");
  });

  it("maps missing character traits to the character check", () => {
    const validation = validateScriptYaml(`metadata:
  title: 雨夜来信
  source_chapters: 3
  language: zh-CN
  format_version: "1.0"
characters:
  - id: char_001
    name: 林夏
    role: protagonist
scenes: []
summary: {}`);

    expect(checkStatus(validation, "characters")).toBe("fail");
  });

  it("maps empty scene dialogue to the scene dialogue check", () => {
    const validation = validateScriptYaml(`metadata:
  title: 雨夜来信
  source_chapters: 3
  language: zh-CN
  format_version: "1.0"
characters:
  - id: char_001
    name: 林夏
    role: protagonist
    traits:
      - 主动
scenes:
  - id: scene_001
    chapter: 1
    heading: 雨夜来信
    location: 旧书店
    time: 雨夜
    characters:
      - char_001
    action: 林夏收到信。
    dialogue: []
    camera_notes: 近景。
summary: {}`);

    expect(checkStatus(validation, "scene-dialogue")).toBe("fail");
  });

  it("fails dialogue references when valid YAML points to an unknown character id", () => {
    const validation = validateScriptYaml(`metadata:
  title: 雨夜来信
  source_chapters: 3
  language: zh-CN
  format_version: "1.0"
characters:
  - id: char_001
    name: 林夏
    role: protagonist
    traits:
      - 主动
scenes:
  - id: scene_001
    chapter: 1
    heading: 雨夜来信
    location: 旧书店
    time: 雨夜
    characters:
      - char_001
    action: 林夏收到信。
    dialogue:
      - character: char_999
        line: 这封信不对劲。
        emotion: 疑惑
    camera_notes: 近景。
summary:
  logline: 林夏收到信。
  themes:
    - 真相
  adaptation_notes:
    - 保留悬念。`);

    expect(checkStatus(validation, "dialogue-references")).toBe("fail");
  });

  it("maps missing summary fields to the summary check", () => {
    const validation = validateScriptYaml(`metadata:
  title: 雨夜来信
  source_chapters: 3
  language: zh-CN
  format_version: "1.0"
characters:
  - id: char_001
    name: 林夏
    role: protagonist
    traits:
      - 主动
scenes: []
summary:
  logline: 林夏收到信。`);

    expect(checkStatus(validation, "summary")).toBe("fail");
  });
});
