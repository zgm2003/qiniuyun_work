import { describe, expect, it } from "vitest";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { getPromptTemplateByKey } from "./prompt-templates";

class FakePromptTemplateDb implements MysqlQueryRunner {
  rows: RowDataPacket[] = [];
  fail = false;

  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(sql: string): Promise<[T, ...unknown[]]> {
    if (!sql.includes("FROM prompt_templates")) {
      throw new Error(`unexpected sql: ${sql}`);
    }
    if (this.fail) {
      throw new Error("db down");
    }
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
