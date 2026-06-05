import { parseNovelChapters, requireMinimumChapters } from "./chapters";
import type { NovelConversionInput } from "./mock-converter";

export type PromptTemplateKey = "script_generation_chat_yaml" | "script_generation_responses_json";
export type PromptTemplateFormat = "yaml" | "json";
export type PromptTemplateVariableName = "title" | "chapter_count" | "chapters" | "schema_summary" | "quality_rules";
export type PromptTemplateVariables = Record<PromptTemplateVariableName, string>;

export type PromptTemplateRecord = {
  id: string;
  templateKey: PromptTemplateKey;
  version: string;
  format: PromptTemplateFormat;
  systemPrompt: string;
  userPromptTemplate: string;
};

const ALLOWED_VARIABLES: PromptTemplateVariableName[] = ["title", "chapter_count", "chapters", "schema_summary", "quality_rules"];

export const SCRIPT_SCHEMA_SUMMARY = `顶层只能包含 metadata、characters、scenes、summary。
metadata 必须包含 title、source_chapters、language、format_version。
characters 每项必须包含 id、name、role、traits。
scenes 每项必须包含 id、chapter、heading、location、time、characters、action、dialogue、camera_notes。
dialogue 每项必须包含 character、line、emotion。
summary 必须是对象，包含 logline、themes、adaptation_notes。`;

function buildQualityRules(title: string, chapterCount: string): string {
  return `metadata.title 必须等于 ${title}。
metadata.source_chapters 必须等于 ${chapterCount}。
metadata.language 必须是 zh-CN。
metadata.format_version 必须是 1.0。
characters[*].id 使用 char_001 这种稳定 ID。
characters[*].role 只能是 protagonist、antagonist、supporting、narrator、other。
characters[*].traits 至少 1 项。
scenes[*].id 使用 scene_001 这种稳定 ID。
scenes[*].characters 和 dialogue[*].character 必须引用 characters[*].id。
dialogue 至少 1 条。
summary.themes 和 summary.adaptation_notes 必须是字符串数组。
禁止把 summary 输出成字符串。
所有必填字段都必须输出，不要用空字符串兜底。`;
}

function formatChapters(chapters: ReturnType<typeof parseNovelChapters>): string {
  return chapters.map((chapter) => `第${chapter.index}章 ${chapter.title}\n${chapter.body}`).join("\n\n");
}

export function buildScriptPromptVariables(input: NovelConversionInput): PromptTemplateVariables {
  const chapters = parseNovelChapters(input.text);
  requireMinimumChapters(chapters, 3);
  const chapterCount = String(chapters.length);

  return {
    title: input.title,
    chapter_count: chapterCount,
    chapters: formatChapters(chapters),
    schema_summary: SCRIPT_SCHEMA_SUMMARY,
    quality_rules: buildQualityRules(input.title, chapterCount)
  };
}

export function renderPromptTemplate(template: string, variables: PromptTemplateVariables): string {
  return template.replace(/{{\s*([a-z_]+)\s*}}/g, (_match, variableName: string) => {
    if (!ALLOWED_VARIABLES.includes(variableName as PromptTemplateVariableName)) {
      throw new Error(`Prompt 模板包含不支持的变量：${variableName}`);
    }

    const value = variables[variableName as PromptTemplateVariableName];
    if (!value) {
      throw new Error(`Prompt 模板变量不能为空：${variableName}`);
    }

    return value;
  });
}

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplateRecord[] = [
  {
    id: "default-script-generation-chat-yaml-v1",
    templateKey: "script_generation_chat_yaml",
    version: "v1",
    format: "yaml",
    systemPrompt: "你只输出符合要求的 YAML。不要 Markdown 解释，不要额外注释。",
    userPromptTemplate: `你是小说改编剧本助手。请把下面小说改编成严格 YAML，不要输出解释文字，不要 Markdown 代码块。

结构要求：
{{schema_summary}}

质量规则：
{{quality_rules}}

必须严格参考这个 YAML 形状：
metadata:
  title: "{{title}}"
  source_chapters: {{chapter_count}}
  language: "zh-CN"
  format_version: "1.0"
characters:
  - id: "char_001"
    name: "角色名"
    role: "protagonist"
    traits:
      - "性格特征"
scenes:
  - id: "scene_001"
    chapter: 1
    heading: "场景标题"
    location: "地点"
    time: "时间"
    characters:
      - "char_001"
    action: "动作描述"
    dialogue:
      - character: "char_001"
        line: "台词"
        emotion: "情绪"
    camera_notes: "镜头或舞台提示"
summary:
  logline: "一句话故事梗概"
  themes:
    - "主题"
  adaptation_notes:
    - "改编说明"

小说标题：{{title}}
章节数量：{{chapter_count}}
小说章节：
{{chapters}}`
  },
  {
    id: "default-script-generation-responses-json-v1",
    templateKey: "script_generation_responses_json",
    version: "v1",
    format: "json",
    systemPrompt: "你是小说改编剧本助手。只返回符合 JSON Schema 的剧本文档，不要解释。",
    userPromptTemplate: `请把下面小说改编成严格 JSON 剧本文档；只输出 JSON，不要解释文字。

结构要求：
{{schema_summary}}

质量规则：
{{quality_rules}}

小说标题：{{title}}
章节数量：{{chapter_count}}
小说章节：
{{chapters}}`
  }
];

export function resolveDefaultPromptTemplate(templateKey: PromptTemplateKey): PromptTemplateRecord {
  const template = DEFAULT_PROMPT_TEMPLATES.find((item) => item.templateKey === templateKey);
  if (!template) {
    throw new Error(`默认 Prompt 模板不存在：${templateKey}`);
  }

  return template;
}
