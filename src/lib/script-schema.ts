import { parse, stringify } from "yaml";
import { z } from "zod";

const NonEmptyString = z.string().min(1, "不能为空");

export const ScriptMetadataSchema = z.object({
  title: NonEmptyString,
  source_chapters: z.number().int().min(3),
  language: NonEmptyString,
  format_version: NonEmptyString
});

export const ScriptCharacterSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  role: z.enum(["protagonist", "antagonist", "supporting", "narrator", "other"]),
  traits: z.array(NonEmptyString).min(1)
});

export const ScriptDialogueSchema = z.object({
  character: NonEmptyString,
  line: NonEmptyString,
  emotion: NonEmptyString
});

export const ScriptSceneSchema = z.object({
  id: NonEmptyString,
  chapter: z.number().int().min(1),
  heading: NonEmptyString,
  location: NonEmptyString,
  time: NonEmptyString,
  characters: z.array(NonEmptyString).min(1),
  action: NonEmptyString,
  dialogue: z.array(ScriptDialogueSchema).min(1),
  camera_notes: NonEmptyString
});

export const ScriptSummarySchema = z.object({
  logline: NonEmptyString,
  themes: z.array(NonEmptyString).min(1),
  adaptation_notes: z.array(NonEmptyString).min(1)
});

export const ScriptDocumentSchema = z.object({
  metadata: ScriptMetadataSchema,
  characters: z.array(ScriptCharacterSchema).min(1),
  scenes: z.array(ScriptSceneSchema).min(1),
  summary: ScriptSummarySchema
});

export type ScriptDocument = z.infer<typeof ScriptDocumentSchema>;

export type ScriptValidationError = {
  path: string;
  message: string;
};

export type ScriptValidationResult =
  | { ok: true; document: ScriptDocument }
  | { ok: false; errors: ScriptValidationError[] };

function formatPath(path: PropertyKey[]): string {
  return path.map(String).join(".") || "root";
}

export function validateScriptYaml(yamlText: string): ScriptValidationResult {
  let parsed: unknown;

  try {
    parsed = parse(yamlText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "YAML 解析失败";
    return {
      ok: false,
      errors: [{ path: "yaml", message }]
    };
  }

  const result = ScriptDocumentSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message
      }))
    };
  }

  return { ok: true, document: result.data };
}

export function stringifyScriptDocument(document: ScriptDocument): string {
  const validDocument = ScriptDocumentSchema.parse(document);
  return stringify(validDocument, { lineWidth: 0 });
}

