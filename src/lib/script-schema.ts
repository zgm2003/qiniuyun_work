import { parse, stringify } from "yaml";
import { z } from "zod";

const NonEmptyString = z.string().min(1, "不能为空");

export const ScriptMetadataSchema = z.object({
  title: NonEmptyString,
  source_chapters: z.number().int().min(3),
  language: NonEmptyString,
  format_version: NonEmptyString
}).strict();

export const ScriptCharacterSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  role: z.enum(["protagonist", "antagonist", "supporting", "narrator", "other"]),
  traits: z.array(NonEmptyString).min(1)
}).strict();

export const ScriptDialogueSchema = z.object({
  character: NonEmptyString,
  line: NonEmptyString,
  emotion: NonEmptyString
}).strict();

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
}).strict();

export const ScriptSummarySchema = z.object({
  logline: NonEmptyString,
  themes: z.array(NonEmptyString).min(1),
  adaptation_notes: z.array(NonEmptyString).min(1)
}).strict();

export const ScriptDocumentSchema = z.object({
  metadata: ScriptMetadataSchema,
  characters: z.array(ScriptCharacterSchema).min(1),
  scenes: z.array(ScriptSceneSchema).min(1),
  summary: ScriptSummarySchema
}).strict();

export type ScriptDocument = z.infer<typeof ScriptDocumentSchema>;

export type ScriptValidationError = {
  path: string;
  message: string;
};

export type ScriptValidationResult =
  | { ok: true; document: ScriptDocument }
  | { ok: false; errors: ScriptValidationError[] };

export type ScriptDocumentParseResult =
  | { ok: true; document: ScriptDocument }
  | { ok: false; errors: ScriptValidationError[] };

function formatPath(path: PropertyKey[]): string {
  return path.map(String).join(".") || "root";
}

function formatZodErrors(error: z.ZodError): ScriptValidationError[] {
  return error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message
  }));
}

export function parseScriptDocumentJson(value: unknown): ScriptDocumentParseResult {
  const result = ScriptDocumentSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, errors: formatZodErrors(result.error) };
  }

  return { ok: true, document: result.data };
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
      errors: formatZodErrors(result.error)
    };
  }

  return { ok: true, document: result.data };
}

export function stringifyScriptDocument(document: ScriptDocument): string {
  const validDocument = ScriptDocumentSchema.parse(document);
  return stringify(validDocument, { lineWidth: 0 });
}

export const SCRIPT_DOCUMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["metadata", "characters", "scenes", "summary"],
  properties: {
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["title", "source_chapters", "language", "format_version"],
      properties: {
        title: { type: "string", minLength: 1 },
        source_chapters: { type: "integer", minimum: 3 },
        language: { type: "string", minLength: 1 },
        format_version: { type: "string", const: "1.0" }
      }
    },
    characters: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "role", "traits"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          role: {
            type: "string",
            enum: ["protagonist", "antagonist", "supporting", "narrator", "other"]
          },
          traits: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 }
          }
        }
      }
    },
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "chapter", "heading", "location", "time", "characters", "action", "dialogue", "camera_notes"],
        properties: {
          id: { type: "string", minLength: 1 },
          chapter: { type: "integer", minimum: 1 },
          heading: { type: "string", minLength: 1 },
          location: { type: "string", minLength: 1 },
          time: { type: "string", minLength: 1 },
          characters: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 }
          },
          action: { type: "string", minLength: 1 },
          dialogue: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["character", "line", "emotion"],
              properties: {
                character: { type: "string", minLength: 1 },
                line: { type: "string", minLength: 1 },
                emotion: { type: "string", minLength: 1 }
              }
            }
          },
          camera_notes: { type: "string", minLength: 1 }
        }
      }
    },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["logline", "themes", "adaptation_notes"],
      properties: {
        logline: { type: "string", minLength: 1 },
        themes: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 }
        },
        adaptation_notes: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 }
        }
      }
    }
  }
} as const;

