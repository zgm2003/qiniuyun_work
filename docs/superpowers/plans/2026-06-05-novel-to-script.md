# AI 小说转剧本工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个输入 3 个以上小说章节并输出可校验 YAML 剧本初稿的 Next.js 应用。

**Architecture:** 纯逻辑放在 `src/lib`，API route 只负责编排，页面只负责交互展示。mock provider 保证无密钥可录屏，OpenAI 兼容 provider 作为可选增强。

**Tech Stack:** Next.js, React, TypeScript, Zod, yaml, Vitest.

---

## File Structure

- `src/lib/chapters.ts`：章节切分和至少 3 章校验。
- `src/lib/script-schema.ts`：Zod Schema、TypeScript 类型、YAML parse/stringify/validate。
- `src/lib/mock-converter.ts`：确定性的小说到剧本转换器。
- `src/app/api/convert/route.ts`：转换 API。
- `src/app/page.tsx`：前端主页面。
- `docs/script-yaml-schema.md`：题目要求的 YAML Schema 设计文档。
- `samples/novel-3chapters.txt`：录屏样例输入。
- `samples/output.yaml`：样例输出。

## Tasks

### Task 1: Project Scaffold

- [ ] Create Next.js + TypeScript project files.
- [ ] Add README, env example, gitignore.
- [ ] Commit `chore: initialize project scaffold`.

### Task 2: Chapter Parser

- [ ] Write Vitest tests for chapter splitting and invalid input.
- [ ] Verify tests fail before implementation.
- [ ] Implement `src/lib/chapters.ts`.
- [ ] Verify tests pass.
- [ ] Commit `feat: add chapter parsing`.

### Task 3: Script YAML Schema

- [ ] Write tests for valid script YAML and missing required fields.
- [ ] Verify tests fail before implementation.
- [ ] Implement `src/lib/script-schema.ts`.
- [ ] Add `docs/script-yaml-schema.md`.
- [ ] Verify tests pass.
- [ ] Commit `feat: define script yaml schema`.

### Task 4: Mock Converter

- [ ] Write tests proving 3 chapters produce characters, scenes, report, and valid YAML.
- [ ] Verify tests fail before implementation.
- [ ] Implement `src/lib/mock-converter.ts`.
- [ ] Add samples.
- [ ] Verify tests pass.
- [ ] Commit `feat: add deterministic script converter`.

### Task 5: API and UI

- [ ] Implement `POST /api/convert`.
- [ ] Implement landing page, sample loader, conversion summary, YAML editor, validation result, export.
- [ ] Run tests, lint, and build.
- [ ] Commit `feat: build novel to script interface`.

### Task 6: Documentation and Demo Polish

- [ ] Update README with dependencies, original functionality, local run, demo script, PR plan.
- [ ] Add PR description templates.
- [ ] Run tests and build.
- [ ] Commit `docs: add demo and contribution workflow`.
