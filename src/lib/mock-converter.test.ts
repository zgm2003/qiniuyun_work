import { describe, expect, it } from "vitest";
import { validateScriptYaml } from "./script-schema";
import { convertNovelToScript } from "./mock-converter";

const novel = `第1章 雨夜来信
林夏在旧书店收到一封没有署名的信。信里说，十年前的火灾不是意外。

第2章 地铁尽头
林夏带着信来到末班地铁。陈默出现，提醒她不要继续追查。

第3章 天台对峙
林夏和陈默在天台对峙。陈默承认自己隐藏了真相，但他也是为了保护她。`;

describe("convertNovelToScript", () => {
  it("turns three novel chapters into valid script YAML and a measurable report", () => {
    const result = convertNovelToScript({ title: "雨夜来信", text: novel });

    expect(result.report).toEqual({
      provider: "mock",
      chapterCount: 3,
      characterCount: 2,
      sceneCount: 3,
      dialogueLineCount: 3,
      validationPassed: true
    });

    const validation = validateScriptYaml(result.yaml);
    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      throw new Error("generated YAML should pass schema validation");
    }
    expect(validation.document.metadata.title).toBe("雨夜来信");
    expect(validation.document.scenes.map((scene) => scene.chapter)).toEqual([1, 2, 3]);
    expect(validation.document.characters.map((character) => character.name)).toEqual([
      "林夏",
      "陈默"
    ]);
  });

  it("rejects input with fewer than three chapters before generating YAML", () => {
    expect(() =>
      convertNovelToScript({
        title: "短篇",
        text: `第1章 独白\n只有一个章节。`
      })
    ).toThrow("至少需要 3 个章节，当前只有 1 个章节");
  });
});
