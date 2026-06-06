import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool, type MysqlQueryRunner } from "@/lib/db/mysql";
import {
  DEFAULT_PROMPT_TEMPLATES,
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

export async function ensureDefaultPromptTemplates(runner?: MysqlQueryRunner): Promise<void> {
  const db = resolveRunner(runner);
  const now = new Date();

  for (const template of DEFAULT_PROMPT_TEMPLATES) {
    await db.query<ResultSetHeader>(
      `INSERT INTO prompt_templates (
         id, template_key, version, format, system_prompt, user_prompt_template, enabled, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         id = id`,
      [
        template.id,
        template.templateKey,
        template.version,
        template.format,
        template.systemPrompt,
        template.userPromptTemplate,
        1,
        now,
        now
      ]
    );
  }
}

export async function getPromptTemplateByKey(
  templateKey: PromptTemplateKey,
  runner?: MysqlQueryRunner
): Promise<PromptTemplateRecord> {
  try {
    const db = resolveRunner(runner);
    await ensureDefaultPromptTemplates(db);
    const [rows] = await db.query<PromptTemplateRow[]>(
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
