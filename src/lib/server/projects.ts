import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { MysqlQueryRunner, MysqlTransactionConnection, MysqlTransactionRunner } from "@/lib/db/mysql";
import { getMysqlPool } from "@/lib/db/mysql";
import type { ProviderName } from "@/lib/ai-provider";
import type { ConversionReport } from "@/lib/mock-converter";
import { validateScriptYaml, type ScriptValidationResult } from "@/lib/script-schema";

export type ProjectStatus = "draft" | "generated" | "failed";
export type GenerationRunStatus = "running" | "succeeded" | "failed";

export type ProjectRecord = {
  id: string;
  ownerUserId: string | null;
  title: string;
  sourceText: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListItem = Pick<ProjectRecord, "id" | "title" | "status" | "createdAt" | "updatedAt">;

export type ProjectDetail = ProjectRecord & {
  latestVersion: ScriptVersionRecord | null;
};

export type ScriptVersionRecord = {
  id: string;
  projectId: string;
  yaml: string;
  report: ConversionReport;
  validation: Extract<ScriptValidationResult, { ok: true }>;
  createdAt: string;
};

export type GenerationRunRecord = {
  id: string;
  projectId: string;
  provider: ProviderName;
  model: string;
  status: GenerationRunStatus;
  errorMessage: string | null;
  createdAt: string;
};

export type CreateProjectInput = {
  title: string;
  sourceText: string;
  ownerUserId?: string | null;
};

export type UpdateProjectInput = {
  projectId: string;
  ownerUserId: string;
  title: string;
  sourceText: string;
};

export type CreateScriptVersionInput = {
  projectId: string;
  yaml: string;
  report: ConversionReport;
  ownerUserId?: string;
};

export type RecordGenerationRunInput = {
  projectId: string;
  provider: ProviderName;
  model: string;
  status: GenerationRunStatus;
  errorMessage?: string | null;
  ownerUserId?: string;
};

type ProjectRow = RowDataPacket & {
  id: string;
  owner_user_id: string | null;
  title: string;
  source_text: string;
  status: ProjectStatus;
  created_at: Date;
  updated_at: Date;
};

function requireTrimmed(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(message);
  }

  return trimmed;
}

function requireNonBlank(value: string, message: string): string {
  if (!value.trim()) {
    throw new Error(message);
  }

  return value;
}

function resolveRunner(runner?: MysqlQueryRunner): MysqlQueryRunner {
  return runner ?? getMysqlPool();
}

function resolveTransactionRunner(runner?: MysqlQueryRunner): MysqlTransactionRunner {
  const resolved = runner ?? getMysqlPool();
  if (!("getConnection" in resolved) || typeof resolved.getConnection !== "function") {
    throw new Error("数据库连接不支持事务");
  }

  return resolved;
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    sourceText: row.source_text,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function createProject(input: CreateProjectInput, runner?: MysqlQueryRunner): Promise<ProjectRecord> {
  const title = requireTrimmed(input.title, "标题不能为空");
  const sourceText = requireNonBlank(input.sourceText, "小说正文不能为空");
  const ownerUserId = input.ownerUserId ?? null;
  const id = randomUUID();
  const status: ProjectStatus = "draft";
  const createdAtDate = new Date();
  const createdAt = createdAtDate.toISOString();
  const updatedAt = createdAt;

  await resolveRunner(runner).query<ResultSetHeader>(
    `INSERT INTO projects (id, owner_user_id, title, source_text, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, ownerUserId, title, sourceText, status, createdAtDate, createdAtDate]
  );

  return {
    id,
    ownerUserId,
    title,
    sourceText,
    status,
    createdAt,
    updatedAt
  };
}

export async function listProjectsForUser(ownerUserId: string, runner?: MysqlQueryRunner): Promise<ProjectListItem[]> {
  const userId = requireTrimmed(ownerUserId, "ownerUserId 不能为空");
  const [rows] = await resolveRunner(runner).query<ProjectRow[]>(
    `SELECT id, owner_user_id, title, source_text, status, created_at, updated_at
     FROM projects
     WHERE owner_user_id = ?
     ORDER BY updated_at DESC`,
    [userId]
  );

  return rows.map(mapProjectRow).map(({ id, title, status, createdAt, updatedAt }) => ({
    id,
    title,
    status,
    createdAt,
    updatedAt
  }));
}

export async function getProjectForUser(
  projectId: string,
  ownerUserId: string,
  runner?: MysqlQueryRunner
): Promise<ProjectDetail | null> {
  const [rows] = await resolveRunner(runner).query<ProjectRow[]>(
    `SELECT id, owner_user_id, title, source_text, status, created_at, updated_at
     FROM projects
     WHERE id = ? AND owner_user_id = ?
     LIMIT 1`,
    [requireTrimmed(projectId, "projectId 不能为空"), requireTrimmed(ownerUserId, "ownerUserId 不能为空")]
  );
  if (!rows[0]) {
    return null;
  }

  return {
    ...mapProjectRow(rows[0]),
    latestVersion: null
  };
}

export async function updateProjectForUser(input: UpdateProjectInput, runner?: MysqlQueryRunner): Promise<ProjectRecord> {
  const projectId = requireTrimmed(input.projectId, "projectId 不能为空");
  const ownerUserId = requireTrimmed(input.ownerUserId, "ownerUserId 不能为空");
  const title = requireTrimmed(input.title, "标题不能为空");
  const sourceText = requireNonBlank(input.sourceText, "小说正文不能为空");
  const updatedAtDate = new Date();

  const [result] = await resolveRunner(runner).query<ResultSetHeader>(
    `UPDATE projects
     SET title = ?, source_text = ?, updated_at = ?
     WHERE id = ? AND owner_user_id = ?`,
    [title, sourceText, updatedAtDate, projectId, ownerUserId]
  );
  if (result.affectedRows !== 1) {
    throw new Error("项目不存在");
  }

  const detail = await getProjectForUser(projectId, ownerUserId, runner);
  if (!detail) {
    throw new Error("项目不存在");
  }

  return detail;
}

function joinValidationErrors(validation: Extract<ScriptValidationResult, { ok: false }>): string {
  return validation.errors.map((error) => `${error.path}: ${error.message}`).join("; ");
}

async function requireProjectWritable(
  projectId: string,
  ownerUserId: string | undefined,
  runner: MysqlQueryRunner
): Promise<void> {
  if (!ownerUserId) {
    return;
  }

  const [rows] = await runner.query<RowDataPacket[]>(
    `SELECT id
     FROM projects
     WHERE id = ? AND owner_user_id = ?
     LIMIT 1`,
    [projectId, ownerUserId]
  );
  if (rows.length !== 1) {
    throw new Error("项目不存在");
  }
}

export async function createScriptVersion(
  input: CreateScriptVersionInput,
  runner?: MysqlQueryRunner
): Promise<ScriptVersionRecord> {
  const projectId = requireTrimmed(input.projectId, "projectId 不能为空");
  const yaml = requireNonBlank(input.yaml, "YAML 不能为空");
  const validation = validateScriptYaml(yaml);
  if (!validation.ok) {
    throw new Error(`YAML 未通过 Schema 校验：${joinValidationErrors(validation)}`);
  }

  const id = randomUUID();
  const createdAtDate = new Date();
  const createdAt = createdAtDate.toISOString();
  const db = resolveTransactionRunner(runner);
  await requireProjectWritable(projectId, input.ownerUserId, db);
  const connection: MysqlTransactionConnection = await db.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query<ResultSetHeader>(
      `INSERT INTO script_versions (id, project_id, yaml, report_json, validation_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, projectId, yaml, JSON.stringify(input.report), JSON.stringify(validation), createdAtDate]
    );
    await connection.query<ResultSetHeader>(
      `UPDATE projects
       SET status = ?, updated_at = ?
       WHERE id = ?`,
      ["generated", createdAtDate, projectId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    id,
    projectId,
    yaml,
    report: input.report,
    validation,
    createdAt
  };
}

export async function recordGenerationRun(
  input: RecordGenerationRunInput,
  runner?: MysqlQueryRunner
): Promise<GenerationRunRecord> {
  const projectId = requireTrimmed(input.projectId, "projectId 不能为空");
  const model = requireTrimmed(input.model, "model 不能为空");
  const id = randomUUID();
  const createdAtDate = new Date();
  const createdAt = createdAtDate.toISOString();
  const errorMessage = input.errorMessage ?? null;
  const db = resolveRunner(runner);

  await requireProjectWritable(projectId, input.ownerUserId, db);

  await db.query<ResultSetHeader>(
    `INSERT INTO generation_runs (id, project_id, provider, model, status, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, projectId, input.provider, model, input.status, errorMessage, createdAtDate]
  );

  return {
    id,
    projectId,
    provider: input.provider,
    model,
    status: input.status,
    errorMessage,
    createdAt
  };
}
