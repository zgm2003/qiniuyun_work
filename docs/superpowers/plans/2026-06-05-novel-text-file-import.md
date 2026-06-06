# Novel Text File Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-local `.txt` / `.md` novel text import so authors can load source material without copy-paste.

**Architecture:** A pure `file-import` module validates import metadata and derives the editor title from the filename. The page reads the selected file in the browser and applies the import result to existing editor state. No upload API, provider, YAML Schema, or storage changes.

**Tech Stack:** Next.js client component, TypeScript, browser File API, Vitest.

---

### Task 1: File import data module

**Files:**
- Create: `src/lib/file-import.ts`
- Test: `src/lib/file-import.test.ts`

- [ ] Write failing tests for accepting `.txt`, accepting `.md`, rejecting unsupported extensions, rejecting oversized files, rejecting blank content, and deriving title from filename.
- [ ] Implement `prepareNovelTextImport(input)` as a pure function.
- [ ] Keep file size and extension rules explicit; do not silently guess unsupported formats.

### Task 2: Page integration

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] Add a hidden file input and visible “导入文本” button near “加载样例”.
- [ ] Read the selected `.txt` / `.md` file with `file.text()` in the browser.
- [ ] On success, set title from filename, replace novel text, clear YAML/report/error, and clear active draft binding.
- [ ] On failure, show existing error box and do not mutate current editor state.

### Task 3: Documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/demo-script.md`
- Create: `docs/pr-descriptions/pr-12-novel-text-file-import.md`

- [ ] Document local-only text import and supported file types.
- [ ] Add demo step for importing a `.txt` or `.md` file.
- [ ] Run `npm test`, `npm run lint`, and `npm run build` before pushing the PR branch.
