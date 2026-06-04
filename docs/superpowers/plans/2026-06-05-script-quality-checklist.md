# Script Quality Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible script quality checklist that translates YAML validation into user-readable structural checks.

**Architecture:** A pure `script-quality` module consumes `ScriptValidationResult | null` and returns UI-ready checklist items. The page renders those items below YAML validation. No AI provider, API route, YAML Schema, draft storage, or export behavior changes.

**Tech Stack:** Next.js client component, TypeScript, Vitest, existing YAML Schema validator.

---

### Task 1: Script quality data module

**Files:**
- Create: `src/lib/script-quality.ts`
- Test: `src/lib/script-quality.test.ts`

- [ ] Write failing tests for empty YAML pending state, valid YAML full pass, schema failure, missing metadata fields, missing character traits, empty scene dialogue, invalid dialogue character references, and summary completeness.
- [ ] Implement `buildScriptQualityChecklist(validation)` as a pure function.
- [ ] Keep checklist behavior explicit: failed Schema items come from validation paths; cross-reference checks only run when Schema validation succeeds.

### Task 2: Page integration

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] Build checklist from existing `yamlValidation` memo.
- [ ] Render a “剧本质量清单” card below YAML Schema validation.
- [ ] Show passed/failed/pending item state, compact summary count, and actionable descriptions.
- [ ] Do not change YAML export gating in this PR.

### Task 3: Documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/demo-script.md`
- Create: `docs/pr-descriptions/pr-11-script-quality-checklist.md`

- [ ] Document the checklist as structure-quality visibility, not AI story scoring.
- [ ] Add demo steps showing checklist pass/fail after editing YAML.
- [ ] Run `npm test`, `npm run lint`, and `npm run build` before pushing the PR branch.
