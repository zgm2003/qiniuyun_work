# Persistence Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing MySQL project, YAML version, and generation-run persistence visible in the product without adding a database admin surface.

**Architecture:** Keep the current persistence tables and request flows. Expose `/projects` in the primary nav, add a small project-library status/action block to the workbench, and extend project list items with the latest generation run from `generation_runs` using an additive API field.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind v4/global CSS, MySQL via `mysql2`, Vitest.

---

## File Structure

- Modify: `src/features/workspace/workbench-nav.ts` — visible top-nav route list.
- Modify: `src/features/workspace/workbench-nav.test.ts` — route display-order regression test.
- Modify: `src/features/workspace/workspace-page.tsx` — visible project-library binding/save block in the generate card.
- Modify: `src/features/workspace/workspace-page.test.ts` — static markup assertions for the new project-library block.
- Modify: `src/app/globals.css` — styles for project-library block and generation-run metadata.
- Modify: `src/lib/server/projects.ts` — `ProjectListItem` includes latest generation run summary.
- Modify: `src/lib/server/projects.test.ts` — service-level coverage for latest run selection.
- Modify: `src/app/api/projects/route.test.ts` — API returns additive latest-run field.
- Modify: `src/features/workspace/server-projects-client.ts` — front-end type carries latest-run field.
- Modify: `src/features/workspace/server-projects-client.test.ts` — client preserves the latest-run field and old requests.
- Create: `src/features/workspace/generation-run-presenter.ts` — pure display mapping for run status/model/time.
- Create: `src/features/workspace/generation-run-presenter.test.ts` — deterministic tests for run display text.
- Modify: `src/features/workspace/projects-page.tsx` — project cards render latest generation run.
- Modify: `README.md` — document that project library visibly reads MySQL project and generation-run data.

---

### Task 1: Put Project Library in the Primary Navigation

**Files:**
- Modify: `src/features/workspace/workbench-nav.test.ts`
- Modify: `src/features/workspace/workbench-nav.ts`

- [ ] **Step 1: Write the failing navigation test**

Replace the display-order assertion in `src/features/workspace/workbench-nav.test.ts` with:

```ts
test("defines the product workbench routes in display order", () => {
  expect(WORKBENCH_NAV_ITEMS.map((item) => item.href)).toEqual(["/workspace", "/projects", "/script"]);
  expect(WORKBENCH_NAV_ITEMS.find((item) => item.href === "/projects")?.description).toContain("MySQL");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- src/features/workspace/workbench-nav.test.ts
```

Expected: FAIL because `WORKBENCH_NAV_ITEMS` currently only exposes `/workspace` and `/script`.

- [ ] **Step 3: Implement the nav change**

In `src/features/workspace/workbench-nav.ts`, replace `WORKBENCH_NAV_ITEMS` with:

```ts
export const WORKBENCH_NAV_ITEMS: WorkbenchNavItem[] = [
  { href: "/workspace", label: "工作台", description: "小说输入、章节预览、一键生成" },
  { href: "/projects", label: "项目库", description: "MySQL 保存的项目和 YAML 版本" },
  { href: "/script", label: "编辑 YAML", description: "Schema 校验、质量清单、导出" }
];
```

Keep `WORKBENCH_ROUTE_ROOTS` unchanged so `/drafts` and `/report` remain routable.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npm test -- src/features/workspace/workbench-nav.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/features/workspace/workbench-nav.ts src/features/workspace/workbench-nav.test.ts
git commit -m "feat: expose project library navigation"
```

---

### Task 2: Show Project-Library Binding and Save Action on the Workbench

**Files:**
- Modify: `src/features/workspace/workspace-page.test.ts`
- Modify: `src/features/workspace/workspace-page.tsx`

- [ ] **Step 1: Write the failing workbench markup test**

In `src/features/workspace/workspace-page.test.ts`, update the `keeps the visible workbench focused on the novel-to-yaml path` test to assert the visible persistence affordance:

```ts
test("keeps the visible workbench focused on the novel-to-yaml path while showing project persistence", () => {
  const markup = renderWithWorkspaceProvider("development", createElement(WorkspacePage));

  expect(markup).toContain("小说输入");
  expect(markup).toContain("生成准备");
  expect(markup).toContain("章节大纲预览");
  expect(markup).toContain("生成 YAML 剧本");
  expect(markup).toContain("编辑导出");
  expect(markup).toContain("项目库存储");
  expect(markup).toContain("当前未绑定项目库项目");
  expect(markup).toContain("保存到项目库");
  expect(markup).not.toContain("质量报告");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- src/features/workspace/workspace-page.test.ts
```

Expected: FAIL because `WorkspacePage` does not render the project-library block yet.

- [ ] **Step 3: Add derived display values in `WorkspacePage`**

In `src/features/workspace/workspace-page.tsx`, after `const hasGeneratedYaml = ...`, add:

```ts
  const projectLibraryStateText = workspace.serverProjectId ? "已绑定项目库项目" : "当前未绑定项目库项目";
  const projectLibraryMessage = workspace.serverProjectMessage.trim().length > 0
    ? workspace.serverProjectMessage
    : "生成时会自动创建项目；也可以先手动保存当前工作区。";
```

This fallback is a business-empty state for the initial UI, not a substitute for missing database data.

- [ ] **Step 4: Render the project-library block**

In `src/features/workspace/workspace-page.tsx`, insert this block inside `.conversion-card`, after `.conversion-copy` and before the primary conversion button:

```tsx
            <div className="project-persistence-card" aria-label="项目库存储状态">
              <div>
                <p className="section-kicker">Project Library</p>
                <strong>项目库存储</strong>
                <span className={workspace.serverProjectId ? "outline-pill ok" : "outline-pill"}>{projectLibraryStateText}</span>
              </div>
              <p>{projectLibraryMessage}</p>
              <button
                className="secondary-button project-save-button"
                type="button"
                disabled={workspace.isPending}
                onClick={() => void workspace.saveCurrentWorkspaceToServer()}
              >
                保存到项目库
              </button>
            </div>
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
npm test -- src/features/workspace/workspace-page.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/features/workspace/workspace-page.tsx src/features/workspace/workspace-page.test.ts
git commit -m "feat: show project library persistence status"
```

---

### Task 3: Return the Latest Generation Run in Project List Items

**Files:**
- Modify: `src/lib/server/projects.ts`
- Modify: `src/lib/server/projects.test.ts`

- [ ] **Step 1: Write the failing service test**

In `src/lib/server/projects.test.ts`, extend `FakeProjectStoreRunner` with a `generationRuns` array:

```ts
  generationRuns: Array<{
    id: string;
    project_id: string;
    provider: "mock" | "openai-compatible";
    model: string;
    status: "running" | "succeeded" | "failed";
    error_message: string | null;
    created_at: Date;
  }> = [];
```

Then change its project-list branch to recognize the new joined query:

```ts
    if (sql.includes("FROM projects p") && sql.includes("LEFT JOIN generation_runs")) {
      const rows = [...this.projects]
        .sort((left, right) => right.updated_at.getTime() - left.updated_at.getTime())
        .map((project) => {
          const latestRun = this.generationRuns
            .filter((run) => run.project_id === project.id)
            .sort((left, right) => right.created_at.getTime() - left.created_at.getTime() || right.id.localeCompare(left.id))[0];

          return {
            ...project,
            latest_run_id: latestRun?.id ?? null,
            latest_run_provider: latestRun?.provider ?? null,
            latest_run_model: latestRun?.model ?? null,
            latest_run_status: latestRun?.status ?? null,
            latest_run_error_message: latestRun?.error_message ?? null,
            latest_run_created_at: latestRun?.created_at ?? null
          };
        });
      return [rows as RowDataPacket[] as T];
    }
```

The fake runner uses `?? null` here because joined SQL returns `NULL` for projects without runs; that is a real database state.

Add this test under the existing `lists all server project drafts` test:

```ts
  it("lists projects with the latest generation run summary", async () => {
    const runner = new FakeProjectStoreRunner();
    const project = await createProject({ title: "项目 A", sourceText: "原文 A" }, runner);
    runner.generationRuns.push({
      id: "run-old",
      project_id: project.id,
      provider: "openai-compatible",
      model: "cheap-old",
      status: "failed",
      error_message: "旧错误",
      created_at: new Date("2026-06-05T01:00:00.000Z")
    });
    runner.generationRuns.push({
      id: "run-new",
      project_id: project.id,
      provider: "openai-compatible",
      model: "cheap-new",
      status: "succeeded",
      error_message: null,
      created_at: new Date("2026-06-05T02:00:00.000Z")
    });

    const projects = await listProjects(runner);

    expect(projects[0].latestGenerationRun).toEqual({
      id: "run-new",
      projectId: project.id,
      provider: "openai-compatible",
      model: "cheap-new",
      status: "succeeded",
      errorMessage: null,
      createdAt: "2026-06-05T02:00:00.000Z"
    });
  });
```

Update `lists all server project drafts` to assert null for projects without runs:

```ts
expect(projects[0].latestGenerationRun).toBeNull();
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- src/lib/server/projects.test.ts
```

Expected: FAIL because `ProjectListItem` does not include `latestGenerationRun` yet and the SQL does not join `generation_runs`.

- [ ] **Step 3: Add the summary type and row fields**

In `src/lib/server/projects.ts`, replace the `ProjectListItem` type with:

```ts
export type GenerationRunSummary = Pick<
  GenerationRunRecord,
  "id" | "projectId" | "provider" | "model" | "status" | "errorMessage" | "createdAt"
>;

export type ProjectListItem = Pick<ProjectRecord, "id" | "title" | "status" | "createdAt" | "updatedAt"> & {
  latestGenerationRun: GenerationRunSummary | null;
};
```

Extend `ProjectRow` with nullable joined fields:

```ts
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
```

- [ ] **Step 4: Add a mapper for the joined run**

In `src/lib/server/projects.ts`, after `mapProjectRow`, add:

```ts
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
```

The null checks are intentional: `latest_run_id === null` means no run exists; a partially joined run means corrupted data or a broken query.

- [ ] **Step 5: Replace the project list SQL and mapper**

In `listProjects`, replace the query and return mapping with:

```ts
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
```

- [ ] **Step 6: Run the focused test and verify it passes**

Run:

```bash
npm test -- src/lib/server/projects.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/lib/server/projects.ts src/lib/server/projects.test.ts
git commit -m "feat: include latest generation run in projects"
```

---

### Task 4: Carry the Latest Run Through API and Client Types

**Files:**
- Modify: `src/app/api/projects/route.test.ts`
- Modify: `src/features/workspace/server-projects-client.ts`
- Modify: `src/features/workspace/server-projects-client.test.ts`

- [ ] **Step 1: Update API route test data**

In `src/app/api/projects/route.test.ts`, change the mocked project in `returns all server project drafts` to:

```ts
      {
        id: "project-1",
        title: "雨夜来信",
        status: "generated",
        createdAt: "2026-06-05T01:00:00.000Z",
        updatedAt: "2026-06-05T02:00:00.000Z",
        latestGenerationRun: {
          id: "run-1",
          projectId: "project-1",
          provider: "openai-compatible",
          model: "cheap-model",
          status: "succeeded",
          errorMessage: null,
          createdAt: "2026-06-05T02:10:00.000Z"
        }
      }
```

Add this assertion after `expect(body.projects).toHaveLength(1);`:

```ts
expect(body.projects[0].latestGenerationRun).toMatchObject({ model: "cheap-model", status: "succeeded" });
```

- [ ] **Step 2: Run the API test**

Run:

```bash
npm test -- src/app/api/projects/route.test.ts
```

Expected: PASS. The route should already pass through the service result without changing code.

- [ ] **Step 3: Add client-side type**

In `src/features/workspace/server-projects-client.ts`, add:

```ts
export type ServerGenerationRunSummary = {
  id: string;
  projectId: string;
  provider: "mock" | "openai-compatible";
  model: string;
  status: "running" | "succeeded" | "failed";
  errorMessage: string | null;
  createdAt: string;
};
```

Change `ServerProjectListItem` to:

```ts
export type ServerProjectListItem = {
  id: string;
  title: string;
  status: "draft" | "generated" | "failed";
  createdAt: string;
  updatedAt: string;
  latestGenerationRun: ServerGenerationRunSummary | null;
};
```

- [ ] **Step 4: Update client tests**

In `src/features/workspace/server-projects-client.test.ts`, change the first list response to include `latestGenerationRun`:

```ts
{ id: "project-1", title: "雨夜来信", status: "draft", createdAt: "c", updatedAt: "u", latestGenerationRun: null }
```

Change the first expectation to:

```ts
await expect(listServerProjects()).resolves.toEqual([
  { id: "project-1", title: "雨夜来信", status: "draft", createdAt: "c", updatedAt: "u", latestGenerationRun: null }
]);
```

- [ ] **Step 5: Run the client test**

Run:

```bash
npm test -- src/features/workspace/server-projects-client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/app/api/projects/route.test.ts src/features/workspace/server-projects-client.ts src/features/workspace/server-projects-client.test.ts
git commit -m "feat: carry latest generation run to client"
```

---

### Task 5: Render Latest Generation Run on Project Cards

**Files:**
- Create: `src/features/workspace/generation-run-presenter.ts`
- Create: `src/features/workspace/generation-run-presenter.test.ts`
- Modify: `src/features/workspace/projects-page.tsx`

- [ ] **Step 1: Write pure presenter tests**

Create `src/features/workspace/generation-run-presenter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatGenerationRunSummary, getGenerationRunTone } from "./generation-run-presenter";

const succeededRun = {
  id: "run-1",
  projectId: "project-1",
  provider: "openai-compatible" as const,
  model: "cheap-model",
  status: "succeeded" as const,
  errorMessage: null,
  createdAt: "2026-06-05T02:10:00.000Z"
};

describe("generation run presenter", () => {
  it("formats a succeeded generation run", () => {
    expect(formatGenerationRunSummary(succeededRun)).toContain("成功 · cheap-model");
    expect(getGenerationRunTone(succeededRun.status)).toBe("ok");
  });

  it("formats a failed generation run with its error", () => {
    const failedRun = { ...succeededRun, status: "failed" as const, errorMessage: "AI 服务请求失败：500" };

    expect(formatGenerationRunSummary(failedRun)).toContain("失败 · cheap-model");
    expect(formatGenerationRunSummary(failedRun)).toContain("AI 服务请求失败：500");
    expect(getGenerationRunTone(failedRun.status)).toBe("bad");
  });

  it("formats a running generation run", () => {
    const runningRun = { ...succeededRun, status: "running" as const };

    expect(formatGenerationRunSummary(runningRun)).toContain("生成中 · cheap-model");
    expect(getGenerationRunTone(runningRun.status)).toBe("neutral");
  });
});
```

- [ ] **Step 2: Run the presenter test and verify it fails**

Run:

```bash
npm test -- src/features/workspace/generation-run-presenter.test.ts
```

Expected: FAIL because `generation-run-presenter.ts` does not exist.

- [ ] **Step 3: Create the presenter**

Create `src/features/workspace/generation-run-presenter.ts`:

```ts
import type { ServerGenerationRunSummary } from "./server-projects-client";

const STATUS_LABELS: Record<ServerGenerationRunSummary["status"], string> = {
  running: "生成中",
  succeeded: "成功",
  failed: "失败"
};

export function getGenerationRunTone(status: ServerGenerationRunSummary["status"]): "neutral" | "ok" | "bad" {
  if (status === "succeeded") {
    return "ok";
  }
  if (status === "failed") {
    return "bad";
  }
  return "neutral";
}

export function formatGenerationRunSummary(run: ServerGenerationRunSummary): string {
  const base = `${STATUS_LABELS[run.status]} · ${run.model} · ${new Date(run.createdAt).toLocaleString("zh-CN")}`;
  if (run.errorMessage) {
    return `${base} · ${run.errorMessage}`;
  }

  return base;
}
```

- [ ] **Step 4: Run the presenter test and verify it passes**

Run:

```bash
npm test -- src/features/workspace/generation-run-presenter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Render latest run on project cards**

In `src/features/workspace/projects-page.tsx`, add the import:

```ts
import { formatGenerationRunSummary, getGenerationRunTone } from "./generation-run-presenter";
```

Inside each `.draft-card`, after the existing updated-time/status paragraph, insert:

```tsx
              {project.latestGenerationRun ? (
                <p className={`generation-run-line ${getGenerationRunTone(project.latestGenerationRun.status)}`}>
                  最近生成：{formatGenerationRunSummary(project.latestGenerationRun)}
                </p>
              ) : (
                <p className="generation-run-line neutral">暂无生成记录</p>
              )}
```

- [ ] **Step 6: Run related front-end tests**

Run:

```bash
npm test -- src/features/workspace/generation-run-presenter.test.ts src/features/workspace/server-projects-client.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add src/features/workspace/generation-run-presenter.ts src/features/workspace/generation-run-presenter.test.ts src/features/workspace/projects-page.tsx
git commit -m "feat: show latest generation run on projects"
```

---

### Task 6: Style the New Visible Persistence Elements

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/globals.test.ts` if the existing CSS guardrails require class assertions.

- [ ] **Step 1: Add CSS for the project-library block**

In `src/app/globals.css`, near `.generated-next-step`, add:

```css
.project-persistence-card {
  display: grid;
  gap: 12px;
  margin-top: 14px;
  border: 1px solid rgba(207, 202, 192, 0.86);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.68);
  padding: 14px;
  box-shadow: 0 12px 30px rgba(26, 24, 20, 0.06);
}

.project-persistence-card > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.project-persistence-card strong {
  font-size: 15px;
  font-weight: 900;
}

.project-persistence-card p {
  margin: 0;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.55;
}

.project-save-button {
  width: 100%;
}
```

- [ ] **Step 2: Add CSS for latest generation run lines**

In `src/app/globals.css`, near `.draft-card p`, add:

```css
.generation-run-line {
  border-radius: 999px;
  padding: 7px 10px;
  font-weight: 700;
}

.generation-run-line.ok {
  background: var(--success-soft);
  color: var(--success);
}

.generation-run-line.bad {
  background: var(--danger-soft);
  color: var(--danger);
}

.generation-run-line.neutral {
  background: var(--info-soft);
  color: var(--muted-strong);
}
```

- [ ] **Step 3: Add dark-mode CSS**

In `src/app/globals.css`, near the existing `html.dark .generated-next-step` rules, add:

```css
html.dark .project-persistence-card {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
}

html.dark .generation-run-line.neutral {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
}
```

The existing dark tokens for success and danger are already used elsewhere; keep those shared semantics.

- [ ] **Step 4: Run CSS-related tests**

Run:

```bash
npm test -- src/app/globals.test.ts src/features/workspace/workspace-page.test.ts
```

Expected: PASS. If `globals.test.ts` has explicit guardrails for new classes, update it to assert these class names exist rather than snapshotting the whole file.

- [ ] **Step 5: Commit Task 6**

```bash
git add src/app/globals.css src/app/globals.test.ts src/features/workspace/workspace-page.test.ts
git commit -m "style: polish persistence visibility UI"
```

---

### Task 7: Update Documentation and Run Full Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README API notes**

In `README.md`, update the `GET /api/projects` bullet to:

```md
- `GET /api/projects`：读取服务端项目草稿列表；每个项目包含 `latestGenerationRun`，用于在项目库卡片展示最近一次生成的模型、状态和错误。
```

- [ ] **Step 2: Update README demo flow**

In `README.md`, in the demo or usage section, add this bullet near the project-library instructions:

```md
- 工作台会显示“项目库存储”状态；点击“保存到项目库”可手动入库，生成 YAML 时会自动写入项目、YAML 版本和最近生成记录。
```

- [ ] **Step 3: Run all tests**

Run:

```bash
npm test
```

Expected: PASS with no failed tests.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build
```

Expected: exit code 0.

- [ ] **Step 6: Restore unrelated generated files if needed**

If `next-env.d.ts` changes only because Next regenerated it and no code requirement depends on the change, run:

```bash
git restore next-env.d.ts
```

- [ ] **Step 7: Commit Task 7**

```bash
git add README.md
git commit -m "docs: describe visible project persistence"
```

---

## Self-Review

- Spec coverage: navigation exposure, workbench binding/save UI, latest generation run visibility, API compatibility, and documentation are covered by Tasks 1-7.
- Placeholder scan: no unresolved placeholder language is required for implementation.
- Type consistency: service type `GenerationRunSummary`, client type `ServerGenerationRunSummary`, and UI property `latestGenerationRun` use the same field names.
- Scope check: the plan does not add tables, migrations, dashboards, provider/model administration, prompt-template UI, auth, pagination, or search.
