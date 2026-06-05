import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { describe, expect, it } from "vitest";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { convertNovelToScript } from "@/lib/mock-converter";
import {
  createProject,
  createScriptVersion,
  recordGenerationRun,
  type GenerationRunStatus
} from "./projects";

const validNovel = `第1章 雨夜来信
林夏在旧书店收到一封没有署名的信。

第2章 地铁尽头
林夏来到末班地铁。陈默出现。

第3章 天台对峙
林夏和陈默在天台对峙。`;

type QueryCall = {
  sql: string;
  values: readonly unknown[] | undefined;
};

class FakeRunner implements MysqlQueryRunner {
  calls: QueryCall[] = [];

  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<[T]> {
    this.calls.push({ sql, values });
    return [{} as T];
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
    expect(runner.calls[0].values?.[1]).toBe("雨夜来信");
    expect(runner.calls[0].values?.[3]).toBe("draft");
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
    expect(JSON.parse(String(insertCall?.values?.[3]))).toEqual(generated.report);
    expect(JSON.parse(String(insertCall?.values?.[4]))).toMatchObject({ ok: true });
    expect(updateCall?.values?.[0]).toBe("generated");
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

    expect(runner.calls.map((call) => call.sql.split(/\s+/)[0])).toEqual([
      "BEGIN",
      "INSERT",
      "UPDATE",
      "COMMIT",
      "RELEASE"
    ]);
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
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0].sql).toContain("INSERT INTO generation_runs");
    expect(runner.calls[0].values?.[4]).toBe("failed");
    expect(runner.calls[0].values?.[5]).toBe("AI 服务请求失败：500");
  });
});
