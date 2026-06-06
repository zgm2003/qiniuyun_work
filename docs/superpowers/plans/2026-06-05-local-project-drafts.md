# Local Project Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-local project drafts so authors can save, reload, and delete novel-to-script work during demos without a backend.

**Architecture:** Draft persistence is a small versioned localStorage module. The page owns the current editor state and calls the module from event handlers/effects. API keys and model config are deliberately excluded from drafts.

**Tech Stack:** Next.js client component, TypeScript, localStorage, Vitest.

---

### Task 1: Draft storage module

**Files:**
- Create: `src/lib/local-drafts.ts`
- Test: `src/lib/local-drafts.test.ts`

- [ ] Write tests for reading valid drafts, rejecting malformed storage, upserting by id, deleting by id, and preserving YAML/report.
- [ ] Implement `LocalProjectDraft`, `readLocalProjectDrafts`, `upsertLocalProjectDraft`, and `deleteLocalProjectDraft`.
- [ ] Keep storage parsing strict enough to drop bad data, not silently invent missing fields.

### Task 2: Page integration

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] Load draft list after client hydration.
- [ ] Add Save Draft, Load, and Delete UI.
- [ ] Save the current title, novel text, YAML, report, and update timestamp.
- [ ] Do not save API Key, Base URL, model, provider, or temperature.
- [ ] Loading sample clears the active draft id so it cannot overwrite an old draft by accident.

### Task 3: Documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/demo-script.md`
- Create: `docs/pr-descriptions/pr-09-local-drafts.md`

- [ ] Document local drafts as browser-only persistence.
- [ ] Add demo steps for save, refresh, reload, delete.
- [ ] Run `npm test`, `npm run lint`, and `npm run build` before commit.
