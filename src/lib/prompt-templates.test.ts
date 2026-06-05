import { describe, expect, it } from "vitest";
import {
  buildScriptPromptVariables,
  DEFAULT_PROMPT_TEMPLATES,
  renderPromptTemplate,
  resolveDefaultPromptTemplate
} from "./prompt-templates";

const validText = `第1章 雨夜来信
林夏收到一封信。

第2章 地铁尽头
她来到末班地铁。

第3章 天台对峙
真相被揭开。`;

describe("buildScriptPromptVariables", () => {
  it("builds fixed variables from parsed chapters", () => {
    const variables = buildScriptPromptVariables({ title: "雨夜来信", text: validText });

    expect(variables.title).toBe("雨夜来信");
    expect(variables.chapter_count).toBe("3");
    expect(variables.chapters).toContain("第1章 雨夜来信");
    expect(variables.chapters).toContain("林夏收到一封信。");
    expect(variables.schema_summary).toContain("metadata");
    expect(variables.quality_rules).toContain("characters[*].id");
    expect(variables.quality_rules).toContain("雨夜来信");
    expect(variables.quality_rules).toContain("3");
  });

  it("rejects novels with fewer than three chapters", () => {
    expect(() => buildScriptPromptVariables({ title: "短篇", text: "第1章 开端\n只有一章。" })).toThrow(
      "至少需要 3 个章节，当前只有 1 个章节"
    );
  });
});

describe("renderPromptTemplate", () => {
  const variables = {
    title: "雨夜来信",
    chapter_count: "3",
    chapters: "chapters",
    schema_summary: "schema",
    quality_rules: "rules"
  } as const;

  it("replaces only allowed variables", () => {
    const rendered = renderPromptTemplate("标题：{{title}}\n章节：{{ chapter_count }}", variables);

    expect(rendered).toBe("标题：雨夜来信\n章节：3");
  });

  it("rejects unknown variables instead of leaving broken prompts", () => {
    expect(() => renderPromptTemplate("{{title}} {{unknown}}", variables)).toThrow("Prompt 模板包含不支持的变量：unknown");
  });

  it("rejects malformed placeholders instead of leaking them to the provider", () => {
    expect(() => renderPromptTemplate("{{title}} {{bad-name}}", variables)).toThrow("Prompt 模板包含无法识别的占位符：bad-name");
  });

  it("rejects blank variable values instead of hiding data flow bugs", () => {
    expect(() => renderPromptTemplate("{{title}}", { ...variables, title: "" })).toThrow("Prompt 模板变量不能为空：title");
  });
});

describe("default prompt templates", () => {
  it("defines YAML and JSON defaults", () => {
    expect(DEFAULT_PROMPT_TEMPLATES.map((template) => template.templateKey)).toEqual([
      "script_generation_chat_yaml",
      "script_generation_responses_json"
    ]);
    expect(resolveDefaultPromptTemplate("script_generation_chat_yaml").format).toBe("yaml");
    expect(resolveDefaultPromptTemplate("script_generation_responses_json").format).toBe("json");
  });

  it("keeps schema and quality variables in default templates", () => {
    const yamlTemplate = resolveDefaultPromptTemplate("script_generation_chat_yaml");
    const jsonTemplate = resolveDefaultPromptTemplate("script_generation_responses_json");

    expect(yamlTemplate.userPromptTemplate).toContain("{{schema_summary}}");
    expect(yamlTemplate.userPromptTemplate).toContain("{{quality_rules}}");
    expect(jsonTemplate.userPromptTemplate).toContain("{{schema_summary}}");
    expect(jsonTemplate.userPromptTemplate).toContain("{{quality_rules}}");
    expect(jsonTemplate.systemPrompt).toContain("JSON");
  });

  it("renders default templates without leaking placeholders", () => {
    const variables = buildScriptPromptVariables({ title: "雨夜来信", text: validText });
    const yamlTemplate = resolveDefaultPromptTemplate("script_generation_chat_yaml");
    const jsonTemplate = resolveDefaultPromptTemplate("script_generation_responses_json");

    expect(renderPromptTemplate(yamlTemplate.userPromptTemplate, variables)).not.toContain("{{");
    expect(renderPromptTemplate(jsonTemplate.userPromptTemplate, variables)).not.toContain("{{");
  });
});
