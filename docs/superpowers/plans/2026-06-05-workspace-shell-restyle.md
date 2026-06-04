# Workspace Shell Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the current novel-to-script workspace into a neutral SaaS/admin workbench while preserving the existing conversion behavior.

**Architecture:** This PR is visual-only. It keeps all provider, YAML validation, local draft, chapter outline, and conversion state logic in `src/app/page.tsx`, and changes only the rendered shell/classes plus the CSS tokens in `src/app/globals.css`.

**Tech Stack:** Next.js App Router, React, TypeScript, plain CSS, Vitest, ESLint.

---

## File Structure

- Modify: `src/app/page.tsx`
  - Add a lightweight sticky product nav inside the page render.
  - Rename the hero copy from demo/pitch tone to product workbench tone.
  - Keep all event handlers, state, request bodies, and validation logic unchanged.
- Modify: `src/app/globals.css`
  - Replace dark manuscript tokens with neutral light SaaS tokens.
  - Add top nav, card, form, status, draft, quality, and responsive styles.
  - Preserve all existing class names used by the page.
- Create: `docs/pr-descriptions/pr-15-workspace-shell-restyle.md`
  - Document scope, implementation, verification, and compatibility.

## Task 1: Capture visual scope before code changes

- [x] **Step 1: Inspect current page classes**

Run:

```bash
Select-String -Path src\app\page.tsx -Pattern 'className='
```

Expected: list of existing CSS classes, confirming the restyle can mostly reuse classes.

- [x] **Step 2: Inspect current CSS selectors**

Run:

```bash
Select-String -Path src\app\globals.css -Pattern '^\.[a-zA-Z0-9_-]+'
```

Expected: list of existing CSS selectors.

## Task 2: Add product workbench shell markup

- [ ] **Step 1: Modify `src/app/page.tsx` render shell**

Add a top navigation before the main content:

```tsx
<header className="top-nav">
  <div className="top-nav-inner">
    <a className="brand-mark" href="#workspace" aria-label="AI 小说转剧本工作台首页">
      <span className="brand-icon">剧</span>
      <span>
        <strong>ScriptForge</strong>
        <small>AI 小说转剧本</small>
      </span>
    </a>
    <nav aria-label="产品导航">
      <a href="#workspace">工作台</a>
      <a href="#drafts">项目草稿</a>
      <a href="#report">质量报告</a>
      <a href="/docs/style-guideline.md">Guideline</a>
    </nav>
    <span className="nav-status">MVP · Productizing</span>
  </div>
</header>
```

Update the main element to:

```tsx
<main id="workspace" className="app-shell">
```

Change the hero heading to:

```tsx
<h1>小说转剧本工作台</h1>
```

- [ ] **Step 2: Run lint to catch JSX mistakes**

Run:

```bash
npm run lint
```

Expected: no lint errors.

## Task 3: Replace manuscript CSS with neutral product CSS

- [ ] **Step 1: Replace `src/app/globals.css`**

Use the tokens from `docs/style-guideline.md`:

```css
:root {
  color-scheme: light;
  --background: #f7f7f5;
  --foreground: #171717;
  --muted: #737373;
  --muted-strong: #525252;
  --card: #ffffff;
  --card-soft: #fafafa;
  --border: #e5e5e5;
  --border-strong: #d4d4d4;
  --primary: #171717;
  --primary-foreground: #ffffff;
  --danger: #dc2626;
  --success: #16a34a;
  --warning: #d97706;
  --ring: rgba(23, 23, 23, 0.18);
  --shadow: rgba(15, 23, 42, 0.08);
}
```

Keep selectors for all classes currently used by `page.tsx`.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: Next.js production build succeeds.

## Task 4: Add PR documentation

- [ ] **Step 1: Create `docs/pr-descriptions/pr-15-workspace-shell-restyle.md`**

The doc must say:

- this PR only restyles the workspace shell;
- no API/provider/schema behavior changed;
- verification commands are `npm test`, `npm run lint`, `npm run build`.

- [ ] **Step 2: Update `docs/pr-plan.md`**

Append a completed productization PR entry for the workspace shell restyle.

## Task 5: Final verification and commit

- [ ] **Step 1: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected:

- 9 test files pass.
- 46 tests pass.
- ESLint exits 0.
- Next.js build exits 0.

- [ ] **Step 2: Commit**

Run:

```bash
git add src/app/page.tsx src/app/globals.css docs/pr-descriptions/pr-15-workspace-shell-restyle.md docs/pr-plan.md docs/superpowers/plans/2026-06-05-workspace-shell-restyle.md
git commit -m "style: restyle workspace shell"
```

- [ ] **Step 3: Push branch**

Run:

```bash
git push -u origin style/workspace-shell-pr15
```
