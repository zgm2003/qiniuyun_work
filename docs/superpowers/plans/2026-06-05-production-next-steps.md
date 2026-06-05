# Production Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a durable production roadmap so future AI sessions can continue from the current project state without relying on chat history.

**Architecture:** This is a documentation-only planning task. It creates one roadmap document, links it from the README, and validates that the repository still passes its normal test, lint, and build commands.

**Tech Stack:** Markdown, Next.js project documentation, npm verification scripts.

---

## File Structure

- Create: `docs/production-next-steps.md`
  - Defines current state, production priorities, task order, and next-window handoff prompts.
- Modify: `README.md`
  - Adds a visible link to `docs/production-next-steps.md`.
- Create: `docs/superpowers/plans/2026-06-05-production-next-steps.md`
  - Records this execution plan for future agents.

## Scope Guard

This plan does not implement AI provider changes, database persistence, auth, RBAC, Redis, deployment automation, or UI changes. It only locks the order of future work.

### Task 1: Create production next steps roadmap

**Files:**
- Create: `docs/production-next-steps.md`

- [ ] **Step 1: Write roadmap**

Create a Markdown document with:

```text
当前状态
总原则
P0 比赛交付冻结
P1 真实 AI 生产化配置
P2 Responses API 与结构化输出
P3 MySQL 基础持久化
P4 登录与会话
P5 简单 RBAC 和管理端骨架
P6 AI 供应商配置入库
P7 Redis 与异步任务
下个 AI 窗口接力提示
当前不要做
```

- [ ] **Step 2: Verify roadmap mentions the critical order**

Run:

```powershell
rg -n "先做 P1 真实 AI 生产化配置，再做 P3 MySQL 持久化|P1：真实 AI 生产化配置|P3：MySQL 基础持久化" docs/production-next-steps.md
```

Expected: matches for P1, P3, and the handoff answer.

### Task 2: Link roadmap from README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add roadmap link near existing roadmap references**

Add this sentence near the existing roadmap section:

```markdown
上线版下一步顺序和新窗口接力上下文见 `docs/production-next-steps.md`。
```

- [ ] **Step 2: Verify README link**

Run:

```powershell
rg -n "production-next-steps" README.md docs/production-next-steps.md
```

Expected: at least one match in `README.md` and one match from the document path.

### Task 3: Verify roadmap has no placeholder markers

**Files:**
- `docs/production-next-steps.md`

- [ ] **Step 1: Search the roadmap for placeholder markers**

Run:

```powershell
rg -n "TBD|待补|占位|以后再说" docs/production-next-steps.md
```

Expected: no matches.

### Task 4: Verify project baseline

**Files:**
- Documentation only.

- [ ] **Step 1: Run tests**

Run:

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: Next.js build completes and lists routes.

- [ ] **Step 4: Inspect changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected: documentation changes only.

## Self-Review

- Spec coverage: The roadmap records current AI status, production order, database timing, Redis timing, and handoff context.
- Placeholder scan: Task 3 verifies no placeholder wording is present in the roadmap.
- Type consistency: Documentation-only task; runtime types are unchanged.
