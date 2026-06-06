import { describe, expect, it } from "vitest";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { DEFAULT_PROMPT_TEMPLATES } from "@/lib/prompt-templates";
import { ensureDefaultPromptTemplates, getPromptTemplateByKey } from "./prompt-templates";

class FakePromptTemplateDb implements MysqlQueryRunner {
  rows: RowDataPacket[] = [];
  insertedRows: RowDataPacket[] = [];
  fail = false;

  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(
    sql: string,
    values?: unknown[]
  ): Promise<[T, ...unknown[]]> {
    if (this.fail) {
      throw new Error("db down");
    }

    if (sql.includes("INSERT INTO prompt_templates")) {
      const [id, templateKey, version, format, systemPrompt, userPromptTemplate, enabled, createdAt, updatedAt] = values as [
        string,
        string,
        string,
        string,
        string,
        string,
        0 | 1,
        Date,
        Date
      ];
      const exists = [...this.rows, ...this.insertedRows].some(
        (row) => row.template_key === templateKey && row.version === version
      );
      if (!exists) {
        this.insertedRows.push({
          id,
          template_key: templateKey,
          version,
          format,
          system_prompt: systemPrompt,
          user_prompt_template: userPromptTemplate,
          enabled,
          created_at: createdAt,
          updated_at: updatedAt
        } as RowDataPacket);
      }
      return [{ affectedRows: exists ? 0 : 1 } as ResultSetHeader as T];
    }

    if (!sql.includes("FROM prompt_templates")) {
      throw new Error(`unexpected sql: ${sql}`);
    }

    const templateKey = values?.[0];
    const rows = [...this.rows, ...this.insertedRows].filter(
      (row) => row.template_key === templateKey && row.enabled === 1
    );
    return [rows as T];
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
        user_prompt_template: "hello {{title}}",
        enabled: 1
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

  it("seeds default templates into the database before lookup", async () => {
    const db = new FakePromptTemplateDb();

    const template = await getPromptTemplateByKey("script_generation_responses_json", db);

    expect(db.insertedRows).toHaveLength(DEFAULT_PROMPT_TEMPLATES.length);
    expect(template).toMatchObject({
      id: "prompt-responses-json-v1",
      templateKey: "script_generation_responses_json",
      format: "json"
    });
  });

  it("can seed default templates without performing a lookup", async () => {
    const db = new FakePromptTemplateDb();

    await ensureDefaultPromptTemplates(db);

    expect(db.insertedRows.map((row) => row.template_key).sort()).toEqual([
      "script_generation_chat_yaml",
      "script_generation_responses_json"
    ]);
  });

  it("falls back to default when database has no enabled template", async () => {
    const db = new FakePromptTemplateDb();

    await expect(getPromptTemplateByKey("script_generation_responses_json", db)).resolves.toMatchObject({
      id: "prompt-responses-json-v1",
      templateKey: "script_generation_responses_json",
      format: "json"
    });
  });

  it("falls back to default when template lookup fails", async () => {
    const db = new FakePromptTemplateDb();
    db.fail = true;

    await expect(getPromptTemplateByKey("script_generation_chat_yaml", db)).resolves.toMatchObject({
      id: "prompt-chat-yaml-v1",
      templateKey: "script_generation_chat_yaml",
      format: "yaml"
    });
  });
});
