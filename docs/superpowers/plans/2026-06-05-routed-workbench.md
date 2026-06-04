# Routed Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current crowded one-page workspace into separate App Router pages while preserving the existing novel-to-script behavior.

**Architecture:** A shared client-side `WorkspaceProvider` lives under `src/app/(workbench)/layout.tsx`, so `/workspace`, `/script`, `/drafts`, and `/report` can share current project state during client navigation. Route pages are thin wrappers; business UI is moved into `src/features/workspace/*` components.

**Tech Stack:** Next.js App Router, React Context, TypeScript, plain CSS, Vitest, ESLint.

---

## File Structure

- Modify: `src/app/page.tsx`
  - Turn the root route into a lightweight product entry page linking to `/workspace`.
- Create: `src/app/(workbench)/layout.tsx`
  - Wrap workbench pages with shared `WorkspaceProvider` and `WorkbenchShell`.
- Create: `src/app/(workbench)/workspace/page.tsx`
  - Render source input, model config, chapter outline, and generate button.
- Create: `src/app/(workbench)/script/page.tsx`
  - Render YAML editor, Schema validation, quality checklist, and export.
- Create: `src/app/(workbench)/drafts/page.tsx`
  - Render local draft save/load/delete UI.
- Create: `src/app/(workbench)/report/page.tsx`
  - Render conversion report metrics.
- Create: `src/features/workspace/workbench-nav.ts`
  - Define workbench navigation and active route helper.
- Create: `src/features/workspace/workbench-nav.test.ts`
  - Test route config before implementing it.
- Create: `src/features/workspace/workspace-context.tsx`
  - Hold shared state and existing handlers from the old page.
- Create: `src/features/workspace/workbench-shell.tsx`
  - Render sticky top nav and page container.
- Create: `src/features/workspace/workspace-page.tsx`
  - Source/model/outline page.
- Create: `src/features/workspace/script-page.tsx`
  - YAML validation/quality page.
- Create: `src/features/workspace/drafts-page.tsx`
  - Draft management page.
- Create: `src/features/workspace/report-page.tsx`
  - Report metrics page.
- Modify: `src/app/globals.css`
  - Add route entry page styles and adapt existing shell styles to routed pages.
- Modify: `docs/pr-descriptions/pr-15-workspace-shell-restyle.md`
  - Update PR scope from single-page restyle to routed workbench restyle.

## Task 1: TDD route navigation data

- [ ] **Step 1: Write failing test**

Create `src/features/workspace/workbench-nav.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { getActiveWorkbenchRoute, WORKBENCH_NAV_ITEMS } from "./workbench-nav";

describe("workbench nav", () => {
  test("defines the four product workbench routes in display order", () => {
    expect(WORKBENCH_NAV_ITEMS.map((item) => item.href)).toEqual(["/workspace", "/script", "/drafts", "/report"]);
  });

  test("uses workspace as the default active route", () => {
    expect(getActiveWorkbenchRoute("/")).toBe("/workspace");
    expect(getActiveWorkbenchRoute("/unknown")).toBe("/workspace");
  });

  test("matches nested paths to their route root", () => {
    expect(getActiveWorkbenchRoute("/script/review")).toBe("/script");
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/features/workspace/workbench-nav.test.ts
```

Expected: fail because `./workbench-nav` does not exist.

- [ ] **Step 3: Implement `src/features/workspace/workbench-nav.ts`**

```ts
export type WorkbenchRoute = "/workspace" | "/script" | "/drafts" | "/report";

export type WorkbenchNavItem = {
  href: WorkbenchRoute;
  label: string;
  description: string;
};

export const WORKBENCH_NAV_ITEMS: WorkbenchNavItem[] = [
  { href: "/workspace", label: "工作台", description: "小说输入、模型配置、章节大纲" },
  { href: "/script", label: "剧本审查", description: "YAML 编辑、Schema 校验、质量清单" },
  { href: "/drafts", label: "项目草稿", description: "本地草稿保存、加载、删除" },
  { href: "/report", label: "质量报告", description: "章节、角色、场景、台词总结" }
];

export function getActiveWorkbenchRoute(pathname: string): WorkbenchRoute {
  const matched = WORKBENCH_NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matched?.href ?? "/workspace";
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- src/features/workspace/workbench-nav.test.ts
```

Expected: pass.

## Task 2: Extract shared workspace state

- [ ] **Step 1: Move existing state and handlers into `workspace-context.tsx`**

Create a client component context that exposes the current title, novel text, YAML text, report, validation, quality checklist, draft actions, model config, convert, and download actions.

The implementation must preserve:

- same initial sample title/text;
- same `/api/convert` request body;
- same localStorage draft key and draft data structure;
- same API key behavior: not saved in local drafts.

- [ ] **Step 2: Keep helper functions close to the provider**

Move these helpers from the old page into the provider module:

- `isConvertFailure`
- `formatValidationErrors`
- `formatQualityStatus`
- `createDraftId`
- local draft snapshot subscription helpers

- [ ] **Step 3: Run tests**

Run:

```bash
npm test
```

Expected: existing 46 tests plus the nav tests pass.

## Task 3: Split route components

- [ ] **Step 1: Create shell and routes**

Create:

- `src/app/(workbench)/layout.tsx`
- `src/app/(workbench)/workspace/page.tsx`
- `src/app/(workbench)/script/page.tsx`
- `src/app/(workbench)/drafts/page.tsx`
- `src/app/(workbench)/report/page.tsx`
- `src/features/workspace/workbench-shell.tsx`
- `src/features/workspace/workspace-page.tsx`
- `src/features/workspace/script-page.tsx`
- `src/features/workspace/drafts-page.tsx`
- `src/features/workspace/report-page.tsx`

- [ ] **Step 2: Reduce `src/app/page.tsx` to an entry page**

Root `/` should be a simple product landing/entry with links to `/workspace`, `/script`, `/drafts`, `/report`. It should not own the conversion state.

- [ ] **Step 3: Run lint/build**

Run:

```bash
npm run lint
npm run build
```

Expected: route tree compiles and pages are generated.

## Task 4: Update styles and PR docs

- [ ] **Step 1: Update CSS**

Keep the existing neutral visual tokens. Add styles for:

- `.entry-shell`
- `.entry-card`
- `.route-grid`
- `.route-card`
- `.workbench-page`
- `.workbench-page-head`

Remove no longer used one-page-only assumptions where necessary.

- [ ] **Step 2: Update PR docs**

Update `docs/pr-descriptions/pr-15-workspace-shell-restyle.md` to say this PR now splits the workspace into routed pages.

## Task 5: Final verification and push

- [ ] **Step 1: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected:

- 10 test files pass.
- Existing behavior tests still pass.
- ESLint exits 0.
- Next.js build exits 0 and shows `/`, `/workspace`, `/script`, `/drafts`, `/report`.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add src docs
git commit -m "refactor: split workspace into routed pages"
git push
```
