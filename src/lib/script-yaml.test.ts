import { describe, expect, test } from "vitest";
import { scriptDocumentToValidatedYaml } from "./script-yaml";
import { validateScriptYaml, type ScriptDocument } from "./script-schema";

const document: ScriptDocument = {
  metadata: {
    title: "雨夜来信",
    source_chapters: 3,
    language: "zh-CN",
    format_version: "1.0"
  },
  characters: [
    {
      id: "char_001",
      name: "林夏",
      role: "protagonist",
      traits: ["谨慎"]
    }
  ],
  scenes: [
    {
      id: "scene_001",
      chapter: 1,
      heading: "雨夜来信",
      location: "旧书店",
      time: "雨夜",
      characters: ["char_001"],
      action: "林夏收到匿名信。",
      dialogue: [
        {
          character: "char_001",
          line: "这是谁寄来的？",
          emotion: "困惑"
        }
      ],
      camera_notes: "推镜到信封。"
    }
  ],
  summary: {
    logline: "一个女孩追查匿名信背后的真相。",
    themes: ["选择"],
    adaptation_notes: ["保留悬疑节奏。"]
  }
};

describe("scriptDocumentToValidatedYaml", () => {
  test("stringifies a validated script document to YAML that passes the existing schema", () => {
    const yaml = scriptDocumentToValidatedYaml(document);

    expect(yaml).toContain("metadata:");
    expect(yaml).toContain("characters:");
    expect(yaml).toContain("scenes:");
    expect(validateScriptYaml(yaml).ok).toBe(true);
  });

  test("fails loudly when the document cannot pass the YAML exit gate", () => {
    const broken = {
      ...document,
      scenes: []
    };

    expect(() => scriptDocumentToValidatedYaml(broken as ScriptDocument)).toThrow("程序生成的 YAML 未通过 Schema 校验");
  });
});
