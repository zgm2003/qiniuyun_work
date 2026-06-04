# Chapter Outline Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chapter outline preview that shows how the novel input is parsed before conversion.

**Architecture:** A pure `chapter-outline` module converts parsed `NovelChapter[]` into UI-ready outline data. The page renders this data under the novel input. No API, provider, YAML Schema, or storage behavior changes.

**Tech Stack:** Next.js client component, TypeScript, Vitest, existing chapter parser.

---

### Task 1: Chapter outline data module

**Files:**
- Create: `src/lib/chapter-outline.ts`
- Test: `src/lib/chapter-outline.test.ts`

- [ ] Write tests for preserving chapter index/title, counting non-whitespace body characters, truncating previews, reporting missing chapters, and marking empty chapter bodies explicitly.
- [ ] Implement `buildChapterOutline(chapters, options)` with a small versioned data shape for UI use.
- [ ] Keep this module pure: no React, no DOM, no localStorage, no AI calls.

### Task 2: Page integration

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] Build outline from existing `chapters` memo.
- [ ] Render a “章节大纲预览” card below the novel textarea.
- [ ] Show chapter count readiness, missing chapter count, per-chapter title, body character count, and preview.
- [ ] Preserve existing convert button behavior.

### Task 3: Documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/demo-script.md`
- Create: `docs/pr-descriptions/pr-10-chapter-outline-preview.md`

- [ ] Document the chapter outline preview as a pre-conversion visibility feature.
- [ ] Add demo steps showing chapter parsing before conversion.
- [ ] Run `npm test`, `npm run lint`, and `npm run build` before pushing the PR branch.
