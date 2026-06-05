# P2 Responses Structured Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate real AI generation from direct YAML Chat Completions output to Responses API + Structured Outputs JSON, then stringify validated JSON into the existing YAML script format.

**Architecture:** Keep `provider: "openai-compatible"` as the product-facing provider. Add a server-only generation API mode so production can use `/responses` while development can temporarily fall back to `/chat/completions`. Generate strict JSON `ScriptDocument`, validate it with the existing Zod schema, stringify to YAML, and run the existing YAML validator as the final exit gate.

**Tech Stack:** Next.js Route Handlers, TypeScript, Vitest, Zod, yaml, OpenAI-compatible REST fetch, Responses API `text.format` JSON Schema.

---

## Scope Guard

This PR does not add MySQL, Redis, Auth, RBAC, admin provider settings, streaming, function calling, Conversations API, or database table decomposition. It must preserve the题目三 YAML output contract.

## File Structure

- Modify: `src/lib/script-schema.ts`
  - Responsibility: Export `ScriptDocument` parsing from plain JSON and export a matching JSON Schema object for Responses Structured Outputs.
- Modify: `src/lib/script-schema.test.ts`
  - Responsibility: Prove JSON document validation and JSON Schema shape match the YAML contract.
- Create: `src/lib/script-yaml.ts`
  - Responsibility: Convert a validated `ScriptDocument` to YAML and revalidate the YAML exit format.
- Create: `src/lib/script-yaml.test.ts`
  - Responsibility: Prove JSON → YAML conversion preserves schema and rejects bad documents loudly.
- Modify: `src/lib/ai-provider.ts`
  - Responsibility: Add Responses API generation path, keep Chat Completions fallback mode, preserve production policy and `store:false`.
- Modify: `src/lib/ai-provider.test.ts`
  - Responsibility: Prove `/responses` request body, response parsing, refusal handling, invalid JSON handling, Schema rejection, and fallback mode.
- Modify: `.env.example`
  - Responsibility: Add server-only `OPENAI_COMPATIBLE_GENERATION_API=responses`.
- Modify: `README.md`
  - Responsibility: Document that production uses Responses + Structured Outputs and YAML remains the user-facing format.
- Modify: `docs/production-next-steps.md`
  - Responsibility: Mark P2 as planned/current and keep P3 MySQL separate.

## Task 1: JSON document validation and JSON Schema contract

**Files:**
- Modify: `src/lib/script-schema.ts`
- Modify: `src/lib/script-schema.test.ts`

- [ ] **Step 1: Add failing tests for JSON document parsing and JSON Schema top-level shape**

Append tests to `src/lib/script-schema.test.ts`:

```ts
import { parseScriptDocumentJson, SCRIPT_DOCUMENT_JSON_SCHEMA } from "./script-schema";

const validScriptDocument = {
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

test("parses a plain JSON script document with the existing schema", () => {
  const result = parseScriptDocumentJson(validScriptDocument);

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.document.metadata.title).toBe("雨夜来信");
  }
});

test("rejects a JSON script document instead of filling missing fields", () => {
  const broken = {
    ...validScriptDocument,
    summary: "bad summary"
  };

  const result = parseScriptDocumentJson(broken);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors[0].path).toBe("summary");
  }
});

test("exports a strict JSON Schema for Responses Structured Outputs", () => {
  expect(SCRIPT_DOCUMENT_JSON_SCHEMA).toMatchObject({
    type: "object",
    additionalProperties: false,
    required: ["metadata", "characters", "scenes", "summary"]
  });
  expect(SCRIPT_DOCUMENT_JSON_SCHEMA.properties.metadata).toMatchObject({
    type: "object",
    additionalProperties: false,
    required: ["title", "source_chapters", "language", "format_version"]
  });
  expect(SCRIPT_DOCUMENT_JSON_SCHEMA.properties.summary).toMatchObject({
    type: "object",
    additionalProperties: false,
    required: ["logline", "themes", "adaptation_notes"]
  });
});
```

- [ ] **Step 2: Run the targeted test and confirm RED**

```bash
npm test -- src/lib/script-schema.test.ts
```

Expected: fails because `parseScriptDocumentJson` and `SCRIPT_DOCUMENT_JSON_SCHEMA` do not exist.

- [ ] **Step 3: Implement JSON parsing and JSON Schema export**

In `src/lib/script-schema.ts`, keep existing YAML validation exports and add:

```ts
export type ScriptDocumentParseResult =
  | { ok: true; document: ScriptDocument }
  | { ok: false; errors: ScriptValidationError[] };

export function parseScriptDocumentJson(value: unknown): ScriptDocumentParseResult {
  const parsed = ScriptDocumentSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, errors: formatZodErrors(parsed.error) };
  }

  return { ok: true, document: parsed.data };
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
          role: { type: "string", enum: ["protagonist", "antagonist", "supporting", "narrator", "other"] },
          traits: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }
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
          characters: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
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
        themes: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
        adaptation_notes: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }
      }
    }
  }
} as const;
```

If `formatZodErrors` is currently local to `validateScriptYaml`, extract it without changing its returned path format.

- [ ] **Step 4: Run the targeted test and confirm GREEN**

```bash
npm test -- src/lib/script-schema.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/script-schema.ts src/lib/script-schema.test.ts
git commit -m "feat: add script document json schema"
```

## Task 2: JSON document to YAML conversion helper

**Files:**
- Create: `src/lib/script-yaml.ts`
- Create: `src/lib/script-yaml.test.ts`

- [ ] **Step 1: Write failing conversion tests**

Create `src/lib/script-yaml.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { scriptDocumentToValidatedYaml } from "./script-yaml";
import { validateScriptYaml } from "./script-schema";

const document = {
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
      role: "protagonist" as const,
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

    expect(() => scriptDocumentToValidatedYaml(broken)).toThrow("程序生成的 YAML 未通过 Schema 校验");
  });
});
```

- [ ] **Step 2: Run the targeted test and confirm RED**

```bash
npm test -- src/lib/script-yaml.test.ts
```

Expected: fails because `src/lib/script-yaml.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/lib/script-yaml.ts`:

```ts
import YAML from "yaml";
import { validateScriptYaml, type ScriptDocument, type ScriptValidationError } from "./script-schema";

function joinValidationErrors(errors: ScriptValidationError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join("; ");
}

export function scriptDocumentToValidatedYaml(document: ScriptDocument): string {
  const yaml = YAML.stringify(document);
  const validation = validateScriptYaml(yaml);

  if (!validation.ok) {
    throw new Error(`程序生成的 YAML 未通过 Schema 校验：${joinValidationErrors(validation.errors)}`);
  }

  return yaml;
}
```

- [ ] **Step 4: Run the targeted test and confirm GREEN**

```bash
npm test -- src/lib/script-yaml.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/script-yaml.ts src/lib/script-yaml.test.ts
git commit -m "feat: convert script json to yaml"
```

## Task 3: Responses API request body and parser

**Files:**
- Modify: `src/lib/ai-provider.test.ts`
- Modify: `src/lib/ai-provider.ts`

- [ ] **Step 1: Add failing tests for Responses request body and output parsing**

Append tests to `src/lib/ai-provider.test.ts`:

```ts
it("uses Responses API with Structured Outputs when configured", async () => {
  const responseDocument = convertNovelToScript({ title: "雨夜来信", text });
  const parsed = validateScriptYaml(responseDocument.yaml);
  if (!parsed.ok) {
    throw new Error("test fixture must be valid");
  }
  const fetchImpl = vi.fn(async () =>
    new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify(parsed.document)
              }
            ]
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  );

  const result = await convertNovelWithProvider(
    { title: "雨夜来信", text },
    {
      AI_PROVIDER: "openai-compatible",
      OPENAI_COMPATIBLE_GENERATION_API: "responses",
      OPENAI_COMPATIBLE_API_KEY: "test-key",
      OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.test/v1",
      OPENAI_COMPATIBLE_MODEL: "gpt-5.5"
    },
    fetchImpl
  );

  const requestBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as {
    model: string;
    store: boolean;
    text?: { format?: { type?: string; name?: string; strict?: boolean; schema?: unknown } };
  };

  expect(fetchImpl.mock.calls[0][0]).toBe("https://llm.example.test/v1/responses");
  expect(requestBody).toMatchObject({
    model: "gpt-5.5",
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "script_document",
        strict: true
      }
    }
  });
  expect(requestBody.text?.format?.schema).toBeTruthy();
  expect(result.report.provider).toBe("openai-compatible");
  expect(validateScriptYaml(result.yaml).ok).toBe(true);
});
```

- [ ] **Step 2: Run the targeted test and confirm RED**

```bash
npm test -- src/lib/ai-provider.test.ts
```

Expected: new test fails because provider still calls `/chat/completions`.

- [ ] **Step 3: Implement generation API mode and Responses request**

In `src/lib/ai-provider.ts`:

1. Import JSON Schema, JSON parser, and YAML conversion helper.
2. Add a mode resolver:

```ts
type OpenAICompatibleGenerationApi = "chat-completions" | "responses";

function resolveGenerationApi(env: ProviderEnvironment): OpenAICompatibleGenerationApi {
  const configured = env.OPENAI_COMPATIBLE_GENERATION_API;
  if (!configured) {
    return env.NODE_ENV === "production" ? "responses" : "chat-completions";
  }

  if (configured === "chat-completions" || configured === "responses") {
    return configured;
  }

  throw new Error(`不支持的 OPENAI_COMPATIBLE_GENERATION_API：${configured}`);
}
```

3. Keep existing `convertWithOpenAICompatible` as the Chat Completions path.
4. Add `convertWithOpenAIResponses`:

```ts
async function convertWithOpenAIResponses(
  input: NovelConversionInput,
  env: ProviderEnvironment,
  fetchImpl: FetchImplementation,
  modelConfig?: RequestModelConfig
): Promise<NovelConversionResult> {
  const apiKey = modelConfig?.apiKey || env.OPENAI_COMPATIBLE_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_COMPATIBLE_API_KEY 未配置");
  }

  const baseUrl = normalizeOpenAIBaseUrl(modelConfig?.baseUrl ?? env.OPENAI_COMPATIBLE_BASE_URL ?? DEFAULT_OPENAI_BASE_URL);
  const model = modelConfig?.model ?? env.OPENAI_COMPATIBLE_MODEL ?? DEFAULT_MODEL;
  const temperature = modelConfig?.temperature ?? 0.2;
  const response = await fetchImpl(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      temperature,
      instructions: "你是小说改编剧本助手。只返回符合 JSON Schema 的剧本文档，不要解释。",
      input: buildPrompt(input),
      text: {
        format: {
          type: "json_schema",
          name: "script_document",
          strict: true,
          schema: SCRIPT_DOCUMENT_JSON_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AI 服务请求失败：${response.status}`);
  }

  const payload = await readOpenAIResponsesPayload(response);
  const document = parseResponsesScriptDocument(payload);
  const yaml = scriptDocumentToValidatedYaml(document);

  return {
    yaml,
    report: buildReport("openai-compatible", document)
  };
}
```

5. In the `provider === "openai-compatible"` branch:

```ts
const generationApi = resolveGenerationApi(env);
if (generationApi === "responses") {
  return convertWithOpenAIResponses(input, env, fetchImpl, modelConfig);
}
return convertWithOpenAICompatible(input, env, fetchImpl, modelConfig);
```

Do not delete the Chat Completions path yet.

- [ ] **Step 4: Run the targeted test and confirm GREEN**

```bash
npm test -- src/lib/ai-provider.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-provider.ts src/lib/ai-provider.test.ts
git commit -m "feat: generate scripts with responses api"
```

## Task 4: Responses error handling

**Files:**
- Modify: `src/lib/ai-provider.test.ts`
- Modify: `src/lib/ai-provider.ts`

- [ ] **Step 1: Add failing tests for refusal, bad JSON, and invalid structure**

Append tests to `src/lib/ai-provider.test.ts`:

```ts
it("reports a clear Responses refusal", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [{ type: "refusal", refusal: "无法处理该请求" }]
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  );

  await expect(
    convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_GENERATION_API: "responses",
        OPENAI_COMPATIBLE_API_KEY: "test-key"
      },
      fetchImpl
    )
  ).rejects.toThrow("AI 拒绝生成剧本：无法处理该请求");
});

it("reports invalid Responses JSON text", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "not json" }]
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  );

  await expect(
    convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_GENERATION_API: "responses",
        OPENAI_COMPATIBLE_API_KEY: "test-key"
      },
      fetchImpl
    )
  ).rejects.toThrow("AI 服务返回了无法解析的 JSON");
});

it("reports invalid Responses script document structure", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({ summary: "bad" })
              }
            ]
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  );

  await expect(
    convertNovelWithProvider(
      { title: "雨夜来信", text },
      {
        AI_PROVIDER: "openai-compatible",
        OPENAI_COMPATIBLE_GENERATION_API: "responses",
        OPENAI_COMPATIBLE_API_KEY: "test-key"
      },
      fetchImpl
    )
  ).rejects.toThrow("AI 返回的剧本文档未通过 Schema 校验");
});
```

- [ ] **Step 2: Run the targeted test and confirm RED**

```bash
npm test -- src/lib/ai-provider.test.ts
```

Expected: at least one new test fails until parser errors are implemented.

- [ ] **Step 3: Implement Responses payload reader and parser**

Add helpers in `src/lib/ai-provider.ts`:

```ts
type ResponsesPayload = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

async function readOpenAIResponsesPayload(response: Response): Promise<ResponsesPayload> {
  const contentType = response.headers.get("content-type") ?? "";
  const bodyText = await response.text();
  const preview = bodyText.trim().replace(/\s+/g, " ").slice(0, 160);

  if (contentType.toLowerCase().includes("text/html") || bodyText.trimStart().startsWith("<")) {
    throw new Error(`AI 服务返回了 HTML 页面，不是 JSON。请检查 Base URL 是否应以 /v1 结尾。响应预览：${preview}`);
  }

  try {
    return JSON.parse(bodyText) as ResponsesPayload;
  } catch {
    throw new Error(`AI 服务返回了无法解析的 JSON。响应预览：${preview}`);
  }
}

function parseResponsesScriptDocument(payload: ResponsesPayload): ScriptDocument {
  const content = payload.output?.flatMap((item) => (item.type === "message" ? item.content ?? [] : [])) ?? [];
  const refusal = content.find((item) => item.type === "refusal")?.refusal;
  if (refusal) {
    throw new Error(`AI 拒绝生成剧本：${refusal}`);
  }

  const text = content.find((item) => item.type === "output_text")?.text;
  if (!text) {
    throw new Error("AI 服务没有返回结构化剧本内容");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI 服务返回了无法解析的 JSON");
  }

  const validation = parseScriptDocumentJson(parsed);
  if (!validation.ok) {
    throw new Error(`AI 返回的剧本文档未通过 Schema 校验：${joinValidationErrors(validation.errors)}`);
  }

  return validation.document;
}
```

Reuse the existing `joinValidationErrors`; do not duplicate it if Task 3 already imported `ScriptDocument` and validation helpers.

- [ ] **Step 4: Run targeted tests and confirm GREEN**

```bash
npm test -- src/lib/ai-provider.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-provider.ts src/lib/ai-provider.test.ts
git commit -m "fix: handle responses api output errors"
```

## Task 5: Preserve route production sanitization and fallback behavior

**Files:**
- Modify: `src/app/api/convert/route.test.ts`
- Modify: `src/lib/ai-provider.test.ts`

- [ ] **Step 1: Add tests that P1 production sanitization still holds under Responses mode**

In `src/app/api/convert/route.test.ts`, add a production test similar to the existing override test but set:

```ts
process.env.OPENAI_COMPATIBLE_GENERATION_API = "responses";
```

Return a Responses payload with `output_text` JSON. Assert:

```ts
expect(fetchMock.mock.calls[0][0]).toBe("https://env.example.test/v1/responses");
expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ authorization: "Bearer env-key" });
expect(requestBody.model).toBe("env-model");
expect(JSON.stringify(requestBody)).not.toContain("request-key");
expect(JSON.stringify(requestBody)).not.toContain("request-model");
expect(JSON.stringify(requestBody)).not.toContain("request.example.test");
```

In `src/lib/ai-provider.test.ts`, add one fallback test:

```ts
it("can still use Chat Completions when generation API is explicitly configured", async () => {
  // existing chat completions mock shape with choices[0].message.content
  // env.OPENAI_COMPATIBLE_GENERATION_API = "chat-completions"
  // expect URL ends with /chat/completions
});
```

- [ ] **Step 2: Run targeted tests and confirm RED if behavior is missing**

```bash
npm test -- src/app/api/convert/route.test.ts src/lib/ai-provider.test.ts
```

Expected: pass only after Task 3/4 implementation is correct.

- [ ] **Step 3: Fix only real failures**

If the route test fails, do not change the P1 sanitization contract. The route must still pass only sanitized `modelConfig` in production.

If the fallback test fails, fix `resolveGenerationApi` or the provider branch only.

- [ ] **Step 4: Run targeted tests and confirm GREEN**

```bash
npm test -- src/app/api/convert/route.test.ts src/lib/ai-provider.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/convert/route.test.ts src/lib/ai-provider.test.ts src/lib/ai-provider.ts
git commit -m "test: preserve production ai boundaries"
```

## Task 6: Documentation and env alignment

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/production-next-steps.md`
- Optional modify: `docs/demo-script.md`
- Optional modify: `docs/final-demo-guide.md`

- [ ] **Step 1: Update `.env.example`**

Add:

```env
OPENAI_COMPATIBLE_GENERATION_API=responses
```

Keep:

```env
AI_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_MODEL=gpt-5.5
```

- [ ] **Step 2: Update README AI Provider section**

Document:

```text
生产默认使用 Responses API + Structured Outputs。模型先返回严格 JSON 剧本文档，服务端再转换为 YAML 给用户编辑和导出。
```

Also document the fallback:

```text
开发排查时可以设置 OPENAI_COMPATIBLE_GENERATION_API=chat-completions 临时回到旧路径；生产目标是 responses。
```

- [ ] **Step 3: Update production next steps**

In `docs/production-next-steps.md`:

- Mark P2 as the current next implementation target or completed if this PR fully implements it.
- Keep P3 MySQL as next after P2.
- Keep Redis/Auth/RBAC out of P2.

- [ ] **Step 4: Search stale docs**

Run:

```powershell
rg -n "直接输出 YAML|Chat Completions|OPENAI_COMPATIBLE_GENERATION_API|Responses API|Structured Outputs|MySQL|Redis|RBAC" README.md .env.example docs/production-next-steps.md docs/demo-script.md docs/final-demo-guide.md
```

Expected:

- `Chat Completions` only appears as fallback/current-history text.
- `MySQL/Redis/RBAC` only appear as later roadmap, not P2 scope.
- `OPENAI_COMPATIBLE_GENERATION_API=responses` appears in env/docs.

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md docs/production-next-steps.md docs/demo-script.md docs/final-demo-guide.md
git commit -m "docs: document responses structured output"
```

## Task 7: Full verification

**Files:** all changed files.

- [ ] **Step 1: Run full tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no lint errors.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: production build succeeds.

- [ ] **Step 4: Inspect diff**

```bash
git status --short
git diff --stat
```

Expected: only Responses API + Structured Outputs implementation, tests, and docs. No database/auth/RBAC/admin files.

- [ ] **Step 5: Commit any final verification-only doc updates**

Only commit if Task 7 revealed doc-only corrections. Do not create empty commits.

## Self-Review Checklist

- Spec coverage: Tasks cover JSON Schema, JSON parsing, YAML conversion, Responses request/response, errors, P1 production boundary, docs, and full verification.
- Scope: No MySQL, Redis, Auth, RBAC, admin settings, streaming, function calling, or Conversations API.
- Compatibility: User-facing YAML contract remains unchanged; mock and Chat Completions fallback remain available for tests/development.
- Safety: Production still uses server-owned API key and `store:false`.
- No placeholders: Every task has exact files, commands, expected results, and concrete code shape.
