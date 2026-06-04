import { describe, expect, it } from "vitest";
import {
  ScriptDocumentSchema,
  stringifyScriptDocument,
  validateScriptYaml
} from "./script-schema";

const validScriptYaml = `metadata:
  title: 雨夜来信
  source_chapters: 3
  language: zh-CN
  format_version: "1.0"
characters:
  - id: char_001
    name: 林夏
    role: protagonist
    traits:
      - 谨慎
      - 执着
scenes:
  - id: scene_001
    chapter: 1
    heading: 雨夜来信
    location: 旧书店
    time: 雨夜
    characters:
      - char_001
    action: 林夏在旧书店收到一封没有署名的信。
    dialogue:
      - character: char_001
        line: 这是谁寄来的？
        emotion: 困惑
    camera_notes: 推镜到信封上的水痕。
summary:
  logline: 一个女孩追查匿名信背后的真相。
  themes:
    - 选择
    - 真相
  adaptation_notes:
    - 保留悬疑节奏，减少旁白。
`;

describe("ScriptDocumentSchema", () => {
  it("accepts a complete script document", () => {
    const result = validateScriptYaml(validScriptYaml);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("valid YAML should pass schema validation");
    }
    expect(result.document.metadata.title).toBe("雨夜来信");
    expect(result.document.scenes[0].dialogue[0].line).toBe("这是谁寄来的？");
  });

  it("does not hide missing required fields with defaults", () => {
    const brokenYaml = validScriptYaml.replace("  title: 雨夜来信\n", "");

    const result = validateScriptYaml(brokenYaml);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("missing metadata.title should fail");
    }
    expect(result.errors).toContainEqual({
      path: "metadata.title",
      message: "Invalid input: expected string, received undefined"
    });
  });

  it("stringifies documents into YAML that still passes validation", () => {
    const document = ScriptDocumentSchema.parse({
      metadata: {
        title: "地铁尽头",
        source_chapters: 3,
        language: "zh-CN",
        format_version: "1.0"
      },
      characters: [
        {
          id: "char_001",
          name: "林夏",
          role: "protagonist",
          traits: ["冷静"]
        }
      ],
      scenes: [
        {
          id: "scene_001",
          chapter: 1,
          heading: "地铁尽头",
          location: "末班地铁",
          time: "深夜",
          characters: ["char_001"],
          action: "林夏走进空无一人的车厢。",
          dialogue: [
            {
              character: "char_001",
              line: "下一站到底是哪？",
              emotion: "警惕"
            }
          ],
          camera_notes: "车厢灯光闪烁。"
        }
      ],
      summary: {
        logline: "匿名信把林夏引向地铁尽头。",
        themes: ["未知"],
        adaptation_notes: ["强化空间压迫感。"]
      }
    });

    const yaml = stringifyScriptDocument(document);
    const result = validateScriptYaml(yaml);

    expect(result.ok).toBe(true);
  });
});
