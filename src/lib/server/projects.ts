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
  title: string;
  sourceText: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type GenerationRunSummary = Pick<
  GenerationRunRecord,
  "id" | "projectId" | "provider" | "model" | "status" | "errorMessage" | "createdAt"
>;

export type ProjectListItem = Pick<ProjectRecord, "id" | "title" | "status" | "createdAt" | "updatedAt"> & {
  latestGenerationRun: GenerationRunSummary | null;
};

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
};

export type UpdateProjectInput = {
  projectId: string;
  title: string;
  sourceText: string;
};

export type CreateScriptVersionInput = {
  projectId: string;
  yaml: string;
  report: ConversionReport;
};

export type RecordGenerationRunInput = {
  projectId: string;
  provider: ProviderName;
  model: string;
  status: GenerationRunStatus;
  errorMessage?: string | null;
};

type ProjectRow = RowDataPacket & {
  id: string;
  title: string;
  source_text: string;
  status: ProjectStatus;
  created_at: Date;
  updated_at: Date;
  latest_run_id?: string | null;
  latest_run_project_id?: string | null;
  latest_run_provider?: ProviderName | null;
  latest_run_model?: string | null;
  latest_run_status?: GenerationRunStatus | null;
  latest_run_error_message?: string | null;
  latest_run_created_at?: Date | null;
};

type ScriptVersionRow = RowDataPacket & {
  id: string;
  project_id: string;
  yaml: string;
  report_json: string | ConversionReport;
  validation_json: string | Extract<ScriptValidationResult, { ok: true }>;
  created_at: Date;
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
    title: row.title,
    sourceText: row.source_text,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapLatestGenerationRun(row: ProjectRow): GenerationRunSummary | null {
  if (!row.latest_run_id) {
    return null;
  }

  if (!row.latest_run_project_id || !row.latest_run_provider || !row.latest_run_model || !row.latest_run_status || !row.latest_run_created_at) {
    throw new Error("generation_runs join returned an incomplete row");
  }

  return {
    id: row.latest_run_id,
    projectId: row.latest_run_project_id,
    provider: row.latest_run_provider,
    model: row.latest_run_model,
    status: row.latest_run_status,
    errorMessage: row.latest_run_error_message ?? null,
    createdAt: row.latest_run_created_at.toISOString()
  };
}

function parseJsonField<T>(value: string | T): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value;
}

function mapScriptVersionRow(row: ScriptVersionRow): ScriptVersionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    yaml: row.yaml,
    report: parseJsonField<ConversionReport>(row.report_json),
    validation: parseJsonField<Extract<ScriptValidationResult, { ok: true }>>(row.validation_json),
    createdAt: row.created_at.toISOString()
  };
}

async function getLatestScriptVersion(projectId: string, runner: MysqlQueryRunner): Promise<ScriptVersionRecord | null> {
  const [rows] = await runner.query<ScriptVersionRow[]>(
    `SELECT id, project_id, yaml, report_json, validation_json, created_at
     FROM script_versions
     WHERE project_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [projectId]
  );

  return rows[0] ? mapScriptVersionRow(rows[0]) : null;
}

export async function createProject(input: CreateProjectInput, runner?: MysqlQueryRunner): Promise<ProjectRecord> {
  const title = requireTrimmed(input.title, "标题不能为空");
  const sourceText = requireNonBlank(input.sourceText, "小说正文不能为空");
  const id = randomUUID();
  const status: ProjectStatus = "draft";
  const createdAtDate = new Date();
  const createdAt = createdAtDate.toISOString();
  const updatedAt = createdAt;

  await resolveRunner(runner).query<ResultSetHeader>(
    `INSERT INTO projects (id, title, source_text, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, title, sourceText, status, createdAtDate, createdAtDate]
  );

  return {
    id,
    title,
    sourceText,
    status,
    createdAt,
    updatedAt
  };
}

export async function listProjects(runner?: MysqlQueryRunner): Promise<ProjectListItem[]> {
  const [rows] = await resolveRunner(runner).query<ProjectRow[]>(
    `SELECT p.id, p.title, p.source_text, p.status, p.created_at, p.updated_at,
            gr.id AS latest_run_id,
            gr.project_id AS latest_run_project_id,
            gr.provider AS latest_run_provider,
            gr.model AS latest_run_model,
            gr.status AS latest_run_status,
            gr.error_message AS latest_run_error_message,
            gr.created_at AS latest_run_created_at
     FROM projects p
     LEFT JOIN generation_runs gr
       ON gr.id = (
         SELECT inner_gr.id
         FROM generation_runs inner_gr
         WHERE inner_gr.project_id = p.id
         ORDER BY inner_gr.created_at DESC, inner_gr.id DESC
         LIMIT 1
       )
     ORDER BY p.updated_at DESC`
  );

  return rows.map((row) => {
    const project = mapProjectRow(row);
    return {
      id: project.id,
      title: project.title,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      latestGenerationRun: mapLatestGenerationRun(row)
    };
  });
}

export async function getProject(projectId: string, runner?: MysqlQueryRunner): Promise<ProjectDetail | null> {
  const db = resolveRunner(runner);
  const [rows] = await db.query<ProjectRow[]>(
    `SELECT id, title, source_text, status, created_at, updated_at
     FROM projects
     WHERE id = ?
     LIMIT 1`,
    [requireTrimmed(projectId, "projectId 不能为空")]
  );
  if (!rows[0]) {
    return null;
  }

  return {
    ...mapProjectRow(rows[0]),
    latestVersion: await getLatestScriptVersion(rows[0].id, db)
  };
}

export async function updateProject(input: UpdateProjectInput, runner?: MysqlQueryRunner): Promise<ProjectRecord> {
  const projectId = requireTrimmed(input.projectId, "projectId 不能为空");
  const title = requireTrimmed(input.title, "标题不能为空");
  const sourceText = requireNonBlank(input.sourceText, "小说正文不能为空");
  const updatedAtDate = new Date();

  const [result] = await resolveRunner(runner).query<ResultSetHeader>(
    `UPDATE projects
     SET title = ?, source_text = ?, updated_at = ?
     WHERE id = ?`,
    [title, sourceText, updatedAtDate, projectId]
  );
  if (result.affectedRows !== 1) {
    throw new Error("项目不存在");
  }

  const detail = await getProject(projectId, runner);
  if (!detail) {
    throw new Error("项目不存在");
  }

  return detail;
}

function joinValidationErrors(validation: Extract<ScriptValidationResult, { ok: false }>): string {
  return validation.errors.map((error) => `${error.path}: ${error.message}`).join("; ");
}

async function requireProjectExists(projectId: string, runner: MysqlQueryRunner): Promise<void> {
  const [rows] = await runner.query<RowDataPacket[]>(
    `SELECT id
     FROM projects
     WHERE id = ?
     LIMIT 1`,
    [projectId]
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
  await requireProjectExists(projectId, db);
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

  await requireProjectExists(projectId, db);

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
