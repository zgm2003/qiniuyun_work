# P5 Prompt Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move hardcoded novel-to-script prompts out of `src/lib/ai-provider.ts` into versioned prompt templates with fixed-variable rendering, MySQL-backed optional lookup, and default fallback without changing the YAML output contract.

**Architecture:** Add a pure prompt template module for defaults, variables, and rendering; add a small server module that reads enabled templates from MySQL and falls back to defaults; then wire `ai-provider` to request the correct template for Chat Completions YAML mode and Responses JSON mode. The final output still goes through `ScriptDocument` / YAML Schema validation.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, mysql2, MySQL InnoDB, existing Zod/YAML schema modules.

---

## Scope Guard

P5 implements Prompt templating only. It does not implement Prompt management UI, audit logs, AI provider encrypted key storage, Redis, workflow orchestration, multi-tenant inheritance, or arbitrary template expressions. `/api/convert` request and response shape stay unchanged.

## File Structure

- Modify `src/lib/db/schema.sql`: add `prompt_templates` table.
- Modify `src/lib/db/schema.test.ts`: assert table fields and lookup indexes exist.
- Create `src/lib/prompt-templates.ts`: default templates, variable construction, fixed-variable rendering, template resolution helpers.
- Create `src/lib/prompt-templates.test.ts`: pure tests for variables and rendering.
- Create `src/lib/server/prompt-templates.ts`: enabled-template lookup with default fallback.
- Create `src/lib/server/prompt-templates.test.ts`: fake DB tests for lookup and fallback.
- Modify `src/lib/ai-provider.ts`: replace local `buildPrompt` / `buildJsonPrompt` hardcoded strings with template rendering.
- Modify `src/app/api/convert/route.test.ts`: assert request bodies contain rendered template content and no request-level secrets in production.
- Modify `docs/production-next-steps.md`, `docs/pr-plan.md`, and `README.md`: mark P5 implemented only after code lands.

---

## Task 1: Add `prompt_templates` schema

**Files:**
- Modify: `src/lib/db/schema.sql`
- Modify: `src/lib/db/schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add assertions to `src/lib/db/schema.test.ts`:

```ts
expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS prompt_templates");
expect(schemaSql).toContain("template_key VARCHAR(100) NOT NULL");
expect(schemaSql).toContain("version VARCHAR(32) NOT NULL");
expect(schemaSql).toContain("format ENUM('yaml', 'json') NOT NULL");
expect(schemaSql).toContain("system_prompt TEXT NOT NULL");
expect(schemaSql).toContain("user_prompt_template MEDIUMTEXT NOT NULL");
expect(schemaSql).toContain("enabled TINYINT(1) NOT NULL DEFAULT 1");
expect(schemaSql).toContain("UNIQUE KEY uk_prompt_templates_key_version (template_key, version)");
expect(schemaSql).toContain("KEY idx_prompt_templates_lookup (template_key, enabled, updated_at)");
```

- [ ] **Step 2: Run schema test and verify it fails**

Run:

```bash
npm test -- src/lib/db/schema.test.ts
```

Expected: FAIL because `prompt_templates` is not in schema yet.

- [ ] **Step 3: Add schema SQL**

Append after `generation_runs` in `src/lib/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS prompt_templates (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  template_key VARCHAR(100) NOT NULL,
  version VARCHAR(32) NOT NULL,
  format ENUM('yaml', 'json') NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template MEDIUMTEXT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_prompt_templates_key_version (template_key, version),
  KEY idx_prompt_templates_lookup (template_key, enabled, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 4: Verify schema test and commit**

Run:

```bash
npm test -- src/lib/db/schema.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/db/schema.sql src/lib/db/schema.test.ts
git commit -m "feat: add prompt template schema"
```

---

## Task 2: Add pure prompt template module

**Files:**
- Create: `src/lib/prompt-templates.ts`
- Create: `src/lib/prompt-templates.test.ts`

- [ ] **Step 1: Write failing tests for variables and rendering**

Create `src/lib/prompt-templates.test.ts`:

```ts
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
  });

  it("rejects novels with fewer than three chapters", () => {
    expect(() => buildScriptPromptVariables({ title: "短篇", text: "第1章 开端\n只有一章。" })).toThrow(
      "至少需要 3 个章节，当前只有 1 个章节"
    );
  });
});

describe("renderPromptTemplate", () => {
  it("replaces only allowed variables", () => {
    const rendered = renderPromptTemplate("标题：{{title}}\n章节：{{chapter_count}}", {
      title: "雨夜来信",
      chapter_count: "3",
      chapters: "chapters",
      schema_summary: "schema",
      quality_rules: "rules"
    });

    expect(rendered).toBe("标题：雨夜来信\n章节：3");
  });

  it("rejects unknown variables instead of leaving broken prompts", () => {
    expect(() =>
      renderPromptTemplate("{{title}} {{unknown}}", {
        title: "雨夜来信",
        chapter_count: "3",
        chapters: "chapters",
        schema_summary: "schema",
        quality_rules: "rules"
      })
    ).toThrow("Prompt 模板包含不支持的变量：unknown");
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
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- src/lib/prompt-templates.test.ts
```

Expected: FAIL because `src/lib/prompt-templates.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/prompt-templates.ts`**

Add:

```ts
import { parseNovelChapters, requireMinimumChapters } from "./chapters";
import type { NovelConversionInput } from "./mock-converter";

export type PromptTemplateKey = "script_generation_chat_yaml" | "script_generation_responses_json";
export type PromptTemplateFormat = "yaml" | "json";
export type PromptTemplateVariables = Record<PromptTemplateVariableName, string>;
export type PromptTemplateVariableName = "title" | "chapter_count" | "chapters" | "schema_summary" | "quality_rules";

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

export const SCRIPT_QUALITY_RULES = `metadata.title 必须等于 {{title}}。
metadata.source_chapters 必须等于 {{chapter_count}}。
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

function formatChapters(chapters: ReturnType<typeof parseNovelChapters>): string {
  return chapters.map((chapter) => `第${chapter.index}章 ${chapter.title}\n${chapter.body}`).join("\n\n");
}

export function buildScriptPromptVariables(input: NovelConversionInput): PromptTemplateVariables {
  const chapters = parseNovelChapters(input.text);
  requireMinimumChapters(chapters, 3);
  const base = {
    title: input.title,
    chapter_count: String(chapters.length),
    chapters: formatChapters(chapters),
    schema_summary: SCRIPT_SCHEMA_SUMMARY,
    quality_rules: SCRIPT_QUALITY_RULES
  } satisfies PromptTemplateVariables;

  return base;
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
```

- [ ] **Step 4: Verify tests and commit**

Run:

```bash
npm test -- src/lib/prompt-templates.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/prompt-templates.ts src/lib/prompt-templates.test.ts
git commit -m "feat: add prompt template renderer"
```

---

## Task 3: Add server template lookup with fallback

**Files:**
- Create: `src/lib/server/prompt-templates.ts`
- Create: `src/lib/server/prompt-templates.test.ts`

- [ ] **Step 1: Write failing server tests**

Create `src/lib/server/prompt-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { getPromptTemplateByKey } from "./prompt-templates";

class FakePromptTemplateDb implements MysqlQueryRunner {
  rows: RowDataPacket[] = [];
  fail = false;

  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(sql: string): Promise<[T, ...unknown[]]> {
    if (!sql.includes("FROM prompt_templates")) throw new Error(`unexpected sql: ${sql}`);
    if (this.fail) throw new Error("db down");
    return [this.rows as T];
  }
}

describe("getPromptTemplateByKey", () => {
  it("maps enabled database templates", async () => {
    const db = new FakePromptTemplateDb();
    db.rows = [
      {
        id: "template-1",
        template_key: "script_generation_chat_yaml",
        version: "v2",
        format: "yaml",
        system_prompt: "system from db",
        user_prompt_template: "hello {{title}}"
      } as RowDataPacket
    ];

    await expect(getPromptTemplateByKey("script_generation_chat_yaml", db)).resolves.toMatchObject({
      id: "template-1",
      templateKey: "script_generation_chat_yaml",
      version: "v2",
      format: "yaml",
      systemPrompt: "system from db",
      userPromptTemplate: "hello {{title}}"
    });
  });

  it("falls back to default when database has no enabled template", async () => {
    const db = new FakePromptTemplateDb();

    await expect(getPromptTemplateByKey("script_generation_responses_json", db)).resolves.toMatchObject({
      id: "default-script-generation-responses-json-v1",
      templateKey: "script_generation_responses_json",
      format: "json"
    });
  });

  it("falls back to default when template lookup fails", async () => {
    const db = new FakePromptTemplateDb();
    db.fail = true;

    await expect(getPromptTemplateByKey("script_generation_chat_yaml", db)).resolves.toMatchObject({
      id: "default-script-generation-chat-yaml-v1",
      templateKey: "script_generation_chat_yaml",
      format: "yaml"
    });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- src/lib/server/prompt-templates.test.ts
```

Expected: FAIL because server module does not exist.

- [ ] **Step 3: Implement server lookup**

Create `src/lib/server/prompt-templates.ts`:

```ts
import type { RowDataPacket } from "mysql2/promise";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { getMysqlPool } from "@/lib/db/mysql";
import {
  resolveDefaultPromptTemplate,
  type PromptTemplateFormat,
  type PromptTemplateKey,
  type PromptTemplateRecord
} from "@/lib/prompt-templates";

type PromptTemplateRow = RowDataPacket & {
  id: string;
  template_key: PromptTemplateKey;
  version: string;
  format: PromptTemplateFormat;
  system_prompt: string;
  user_prompt_template: string;
};

function resolveRunner(runner?: MysqlQueryRunner): MysqlQueryRunner {
  return runner ?? getMysqlPool();
}

function mapPromptTemplateRow(row: PromptTemplateRow): PromptTemplateRecord {
  return {
    id: row.id,
    templateKey: row.template_key,
    version: row.version,
    format: row.format,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template
  };
}

export async function getPromptTemplateByKey(
  templateKey: PromptTemplateKey,
  runner?: MysqlQueryRunner
): Promise<PromptTemplateRecord> {
  try {
    const [rows] = await resolveRunner(runner).query<PromptTemplateRow[]>(
      `SELECT id, template_key, version, format, system_prompt, user_prompt_template
       FROM prompt_templates
       WHERE template_key = ? AND enabled = 1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [templateKey]
    );

    return rows[0] ? mapPromptTemplateRow(rows[0]) : resolveDefaultPromptTemplate(templateKey);
  } catch {
    return resolveDefaultPromptTemplate(templateKey);
  }
}
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test -- src/lib/server/prompt-templates.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/server/prompt-templates.ts src/lib/server/prompt-templates.test.ts
git commit -m "feat: load prompt templates with fallback"
```

---

## Task 4: Wire templates into AI provider

**Files:**
- Modify: `src/lib/ai-provider.ts`
- Modify: `src/app/api/convert/route.test.ts`

- [ ] **Step 1: Write failing provider tests**

In `src/app/api/convert/route.test.ts`, update existing OpenAI-compatible tests to inspect request body:

```ts
expect(JSON.stringify(requestBody)).toContain("结构要求");
expect(JSON.stringify(requestBody)).toContain("质量规则");
expect(JSON.stringify(requestBody)).toContain("第1章 雨夜来信");
expect(JSON.stringify(requestBody)).not.toContain("{{title}}");
```

For Chat Completions test, parse body as:

```ts
type ChatRequestBody = {
  model: string;
  temperature: number;
  messages: Array<{ role: "system" | "user"; content: string }>;
};
const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as ChatRequestBody;
expect(requestBody.messages[0].content).toContain("YAML");
expect(requestBody.messages[1].content).toContain("结构要求");
expect(requestBody.messages[1].content).toContain("质量规则");
expect(requestBody.messages[1].content).not.toContain("{{title}}");
```

For Responses test, parse body as:

```ts
type ResponsesRequestBody = {
  model: string;
  temperature: number;
  instructions: string;
  input: string;
};
const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as ResponsesRequestBody;
expect(requestBody.instructions).toContain("JSON");
expect(requestBody.input).toContain("结构要求");
expect(requestBody.input).toContain("质量规则");
expect(requestBody.input).not.toContain("{{title}}");
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/app/api/convert/route.test.ts
```

Expected: FAIL before provider wiring if old prompt content does not include new template sections.

- [ ] **Step 3: Update `src/lib/ai-provider.ts` imports**

Add:

```ts
import { buildScriptPromptVariables, renderPromptTemplate } from "./prompt-templates";
import { getPromptTemplateByKey } from "./server/prompt-templates";
```

Remove local `buildPrompt` and `buildJsonPrompt` functions after replacing their call sites.

- [ ] **Step 4: Render template in Chat Completions path**

Inside `convertWithOpenAICompatible`, before `fetchImpl`:

```ts
const variables = buildScriptPromptVariables(input);
const promptTemplate = await getPromptTemplateByKey("script_generation_chat_yaml");
const userPrompt = renderPromptTemplate(promptTemplate.userPromptTemplate, variables);
```

Change messages to:

```ts
messages: [
  {
    role: "system",
    content: promptTemplate.systemPrompt
  },
  {
    role: "user",
    content: userPrompt
  }
]
```

- [ ] **Step 5: Render template in Responses path**

Inside `convertWithOpenAIResponses`, before `fetchImpl`:

```ts
const variables = buildScriptPromptVariables(input);
const promptTemplate = await getPromptTemplateByKey("script_generation_responses_json");
const userPrompt = renderPromptTemplate(promptTemplate.userPromptTemplate, variables);
```

Change request body to:

```ts
instructions: promptTemplate.systemPrompt,
input: userPrompt,
```

- [ ] **Step 6: Verify route tests and commit**

Run:

```bash
npm test -- src/app/api/convert/route.test.ts src/lib/prompt-templates.test.ts src/lib/server/prompt-templates.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/ai-provider.ts src/app/api/convert/route.test.ts
git commit -m "feat: render ai prompts from templates"
```

---

## Task 5: Update docs after implementation

**Files:**
- Modify: `README.md`
- Modify: `docs/pr-plan.md`
- Modify: `docs/production-next-steps.md`

- [ ] **Step 1: Update README**

Change the production roadmap sentence from:

```md
Redis 和 AI 供应商配置加密入库仍是后续阶段。
```

to:

```md
Redis 和 AI 供应商配置加密入库仍是后续阶段；Prompt 模板化已完成基础模块和默认 fallback。
```

Add a short section:

```md
## Prompt 模板化

P5 将小说转剧本 Prompt 拆成版本化模板。运行时只允许固定变量替换：标题、章节数、章节正文、Schema 摘要和质量规则。数据库模板缺失时使用默认模板 fallback，转换结果仍必须通过 `ScriptDocument` / YAML Schema 校验。
```

- [ ] **Step 2: Update PR plan**

Move P5 from planned to implemented by changing product stage table:

```md
| P5 | feat | prompt template management | Prompt 模板化；固定变量渲染，输出仍受 YAML Schema 约束。 |
```

Keep PR 18 as next:

```md
### PR 18：AI 供应商配置加密入库
```

- [ ] **Step 3: Update production next steps**

Under `### P5：Prompt 模板化`, add:

```md
状态：已实施基础模块。
```

Do not mark P6 as done.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add README.md docs/pr-plan.md docs/production-next-steps.md
git commit -m "docs: mark prompt templates implemented"
```

---

## Task 6: Final verification

**Files:**
- All modified files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm test -- src/lib/prompt-templates.test.ts src/lib/server/prompt-templates.test.ts src/lib/db/schema.test.ts src/app/api/convert/route.test.ts
```

Expected: all targeted tests PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS and routes still include `/workspace`, `/script`, `/projects`, `/api/convert`.

- [ ] **Step 5: Audit diff and commits**

Run:

```bash
git status --short --branch
git log --oneline -10
```

Expected: working tree clean; commits show schema, renderer, fallback, provider wiring, docs.

---

## Self-Review Checklist

- P5 does not change `/api/convert` request or response shape.
- P5 does not store API Key, Base URL, provider credentials, or model settings.
- P5 does not add Prompt management UI, Redis, workflow orchestration, or script execution.
- The default templates preserve the existing YAML / JSON generation requirements.
- Unknown template variables fail loudly instead of being silently ignored.
- DB lookup fallback is deliberate because template storage is an optional read source in P5.
- Final output remains protected by `ScriptDocument` / YAML Schema validation.
