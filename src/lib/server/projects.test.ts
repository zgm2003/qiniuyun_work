import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { describe, expect, it } from "vitest";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { convertNovelToScript } from "@/lib/mock-converter";
import {
  createProject,
  createScriptVersion,
  getProject,
  listProjects,
  recordGenerationRun,
  type GenerationRunStatus,
  updateProject
} from "./projects";

const validNovel = `第1章 雨夜来信
林夏在旧书店收到一封没有署名的信。

第2章 地铁尽头
林夏来到末班地铁。陈默出现。

第3章 天台对峙
林夏和陈默在天台对峙。`;

type QueryCall = {
  sql: string;
  values: unknown[] | undefined;
};

class FakeRunner implements MysqlQueryRunner {
  calls: QueryCall[] = [];

  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(
    sql: string,
    values?: unknown[]
  ): Promise<[T, ...unknown[]]> {
    this.calls.push({ sql, values });

    if (sql.includes("SELECT id") && sql.includes("FROM projects") && sql.includes("WHERE id = ?")) {
      return [[{ id: values?.[0] }] as RowDataPacket[] as T];
    }

    return [{ affectedRows: 1 } as ResultSetHeader as T];
  }
}

class FakeTransactionalRunner extends FakeRunner {
  async getConnection(): Promise<FakeTransactionalRunner> {
    return this;
  }

  async beginTransaction(): Promise<void> {
    this.calls.push({ sql: "BEGIN", values: undefined });
  }

  async commit(): Promise<void> {
    this.calls.push({ sql: "COMMIT", values: undefined });
  }

  async rollback(): Promise<void> {
    this.calls.push({ sql: "ROLLBACK", values: undefined });
  }

  release(): void {
    this.calls.push({ sql: "RELEASE", values: undefined });
  }
}

class MissingProjectRunner extends FakeTransactionalRunner {
  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(
    sql: string,
    values?: unknown[]
  ): Promise<[T, ...unknown[]]> {
    if (sql.includes("SELECT id") && sql.includes("FROM projects") && sql.includes("WHERE id = ?")) {
      this.calls.push({ sql, values });
      return [[] as RowDataPacket[] as T];
    }

    return super.query<T>(sql, values);
  }
}

class FakeProjectStoreRunner implements MysqlQueryRunner {
  projects: Array<{
    id: string;
    title: string;
    source_text: string;
    status: "draft" | "generated" | "failed";
    created_at: Date;
    updated_at: Date;
  }> = [];
  scriptVersions: Array<{
    id: string;
    project_id: string;
    yaml: string;
    report_json: string;
    validation_json: string;
    created_at: Date;
  }> = [];

  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(
    sql: string,
    values: unknown[] = []
  ): Promise<[T, ...unknown[]]> {
    if (sql.includes("INSERT INTO projects")) {
      const [id, title, sourceText, status, createdAt, updatedAt] = values as [string, string, string, "draft", Date, Date];
      this.projects.push({
        id,
        title,
        source_text: sourceText,
        status,
        created_at: createdAt,
        updated_at: updatedAt
      });
      return [{ affectedRows: 1 } as ResultSetHeader as T];
    }

    if (sql.includes("FROM projects") && sql.includes("ORDER BY updated_at DESC")) {
      const rows = [...this.projects].sort((left, right) => right.updated_at.getTime() - left.updated_at.getTime());
      return [rows as RowDataPacket[] as T];
    }

    if (sql.includes("FROM projects") && sql.includes("WHERE id = ?") && sql.includes("SELECT")) {
      const [projectId] = values as [string];
      return [this.projects.filter((project) => project.id === projectId) as RowDataPacket[] as T];
    }

    if (sql.includes("FROM script_versions") && sql.includes("WHERE project_id = ?")) {
      const [projectId] = values as [string];
      const rows = this.scriptVersions
        .filter((version) => version.project_id === projectId)
        .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())
        .slice(0, 1);
      return [rows as RowDataPacket[] as T];
    }

    if (sql.includes("UPDATE projects") && sql.includes("WHERE id = ?")) {
      const [title, sourceText, updatedAt, projectId] = values as [string, string, Date, string];
      const project = this.projects.find((item) => item.id === projectId);
      if (!project) {
        return [{ affectedRows: 0 } as ResultSetHeader as T];
      }

      project.title = title;
      project.source_text = sourceText;
      project.updated_at = updatedAt;
      return [{ affectedRows: 1 } as ResultSetHeader as T];
    }

    throw new Error(`Unhandled SQL: ${sql}`);
  }
}

describe("project persistence service", () => {
  it("creates a draft project with a trimmed title", async () => {
    const runner = new FakeRunner();

    const project = await createProject(
      {
        title: " 雨夜来信 ",
        sourceText: "第1章 A\n正文"
      },
      runner
    );

    expect(project).toMatchObject({
      title: "雨夜来信",
      sourceText: "第1章 A\n正文",
      status: "draft"
    });
    expect(project.id).toHaveLength(36);
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0].sql).toContain("INSERT INTO projects");
    expect(runner.calls[0].sql).not.toContain("owner_user_id");
    expect(runner.calls[0].values?.[1]).toBe("雨夜来信");
    expect(runner.calls[0].values?.[3]).toBe("draft");
    expect(runner.calls[0].values?.[4]).toBeInstanceOf(Date);
    expect(runner.calls[0].values?.[5]).toBeInstanceOf(Date);
  });

  it("rejects blank project titles instead of inventing a default", async () => {
    const runner = new FakeRunner();

    await expect(createProject({ title: "   ", sourceText: "正文" }, runner)).rejects.toThrow("标题不能为空");
    expect(runner.calls).toHaveLength(0);
  });

  it("rejects blank source text instead of saving an empty project", async () => {
    const runner = new FakeRunner();

    await expect(createProject({ title: "雨夜来信", sourceText: "   " }, runner)).rejects.toThrow("小说正文不能为空");
    expect(runner.calls).toHaveLength(0);
  });

  it("rejects invalid script YAML before touching the database", async () => {
    const runner = new FakeRunner();

    await expect(
      createScriptVersion(
        {
          projectId: "project-1",
          yaml: "metadata:\n  title: 缺字段",
          report: {
            provider: "mock",
            chapterCount: 3,
            characterCount: 1,
            sceneCount: 1,
            dialogueLineCount: 1,
            validationPassed: true
          }
        },
        runner
      )
    ).rejects.toThrow("YAML 未通过 Schema 校验");
    expect(runner.calls).toHaveLength(0);
  });

  it("stores a valid script version and marks the project generated", async () => {
    const runner = new FakeTransactionalRunner();
    const generated = convertNovelToScript({ title: "雨夜来信", text: validNovel });

    const version = await createScriptVersion(
      {
        projectId: "project-1",
        yaml: generated.yaml,
        report: generated.report
      },
      runner
    );

    expect(version).toMatchObject({
      projectId: "project-1",
      yaml: generated.yaml,
      report: generated.report
    });
    expect(version.validation.ok).toBe(true);
    const insertCall = runner.calls.find((call) => call.sql.includes("INSERT INTO script_versions"));
    const updateCall = runner.calls.find((call) => call.sql.includes("UPDATE projects"));
    expect(insertCall).toBeDefined();
    expect(updateCall).toBeDefined();
    expect(insertCall?.sql).not.toContain("CAST(? AS JSON)");
    expect(JSON.parse(String(insertCall?.values?.[3]))).toEqual(generated.report);
    expect(JSON.parse(String(insertCall?.values?.[4]))).toMatchObject({ ok: true });
    expect(updateCall?.values?.[0]).toBe("generated");
    expect(updateCall?.values?.[1]).toBeInstanceOf(Date);
    expect(updateCall?.values?.[2]).toBe("project-1");
  });

  it("wraps script version insert and project status update in one transaction", async () => {
    const runner = new FakeTransactionalRunner();
    const generated = convertNovelToScript({ title: "雨夜来信", text: validNovel });

    await createScriptVersion(
      {
        projectId: "project-1",
        yaml: generated.yaml,
        report: generated.report
      },
      runner
    );

    expect(runner.calls.map((call) => call.sql.trim().split(/\s+/)[0])).toEqual([
      "SELECT",
      "BEGIN",
      "INSERT",
      "UPDATE",
      "COMMIT",
      "RELEASE"
    ]);
  });

  it("rejects script versions for missing projects", async () => {
    const runner = new MissingProjectRunner();
    const generated = convertNovelToScript({ title: "雨夜来信", text: validNovel });

    await expect(createScriptVersion({ projectId: "missing-project", yaml: generated.yaml, report: generated.report }, runner)).rejects.toThrow(
      "项目不存在"
    );
    expect(runner.calls.some((call) => call.sql.includes("INSERT INTO script_versions"))).toBe(false);
  });

  it("records generation runs without changing project assets", async () => {
    const runner = new FakeRunner();
    const status: GenerationRunStatus = "failed";

    const run = await recordGenerationRun(
      {
        projectId: "project-1",
        provider: "openai-compatible",
        model: "gpt-5.5",
        status,
        errorMessage: "AI 服务请求失败：500"
      },
      runner
    );

    expect(run).toMatchObject({
      projectId: "project-1",
      provider: "openai-compatible",
      model: "gpt-5.5",
      status,
      errorMessage: "AI 服务请求失败：500"
    });
    expect(runner.calls).toHaveLength(2);
    expect(runner.calls[0].sql).toContain("FROM projects");
    expect(runner.calls[1].sql).toContain("INSERT INTO generation_runs");
    expect(runner.calls[1].values?.[4]).toBe("failed");
    expect(runner.calls[1].values?.[5]).toBe("AI 服务请求失败：500");
    expect(runner.calls[1].values?.[6]).toBeInstanceOf(Date);
  });

  it("rejects generation runs for missing projects", async () => {
    const runner = new MissingProjectRunner();

    await expect(
      recordGenerationRun({ projectId: "missing-project", provider: "openai-compatible", model: "gpt-5.5", status: "failed" }, runner)
    ).rejects.toThrow("项目不存在");
    expect(runner.calls.some((call) => call.sql.includes("INSERT INTO generation_runs"))).toBe(false);
  });

  it("lists all server project drafts", async () => {
    const runner = new FakeProjectStoreRunner();
    await createProject({ title: "项目 A", sourceText: "原文 A" }, runner);
    await createProject({ title: "项目 B", sourceText: "原文 B" }, runner);
    runner.projects[0].updated_at = new Date("2026-06-05T01:00:00.000Z");
    runner.projects[1].updated_at = new Date("2026-06-05T02:00:00.000Z");

    const projects = await listProjects(runner);

    expect(projects.map((project) => project.title)).toEqual(["项目 B", "项目 A"]);
  });

  it("loads the latest script version for a project", async () => {
    const runner = new FakeProjectStoreRunner();
    const project = await createProject({ title: "项目 A", sourceText: "原文 A" }, runner);
    const generated = convertNovelToScript({ title: "项目 A", text: validNovel });
    runner.scriptVersions.push({
      id: "version-old",
      project_id: project.id,
      yaml: "old yaml",
      report_json: JSON.stringify({ ...generated.report, sceneCount: 1 }),
      validation_json: JSON.stringify({ ok: true }),
      created_at: new Date("2026-06-05T01:00:00.000Z")
    });
    runner.scriptVersions.push({
      id: "version-new",
      project_id: project.id,
      yaml: generated.yaml,
      report_json: JSON.stringify(generated.report),
      validation_json: JSON.stringify({ ok: true }),
      created_at: new Date("2026-06-05T02:00:00.000Z")
    });

    const detail = await getProject(project.id, runner);

    expect(detail?.latestVersion).toMatchObject({
      id: "version-new",
      projectId: project.id,
      yaml: generated.yaml,
      report: generated.report,
      validation: { ok: true },
      createdAt: "2026-06-05T02:00:00.000Z"
    });
  });

  it("updates a project draft", async () => {
    const runner = new FakeProjectStoreRunner();
    const project = await createProject({ title: "项目 A", sourceText: "原文 A" }, runner);

    await expect(updateProject({ projectId: "missing-project", title: "坏更新", sourceText: "坏正文" }, runner)).rejects.toThrow("项目不存在");
    await expect(updateProject({ projectId: project.id, title: "好更新", sourceText: "好正文" }, runner)).resolves.toMatchObject({
      id: project.id,
      title: "好更新",
      sourceText: "好正文"
    });
  });
});
