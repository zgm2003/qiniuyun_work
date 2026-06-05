# Production AI Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current real OpenAI-compatible AI integration production-safe by default: server-owned API key, no production mock, no production request-level credential override, and deployment docs that match the上线目标.

**Architecture:** Keep the existing Chat Completions compatible provider for this PR to avoid mixing API migration with production config hardening. Add environment-aware policy in the API/provider boundary, preserve mock for tests and development, and hide sensitive model fields in production UI.

**Tech Stack:** Next.js App Router Route Handlers, React client components, TypeScript, Vitest, Zod, existing OpenAI-compatible fetch implementation.

---

## File Structure

- Modify: `src/lib/ai-provider.ts`
  - Responsibility: Enforce production provider policy and add `store: false` to real AI requests.
- Modify: `src/lib/ai-provider.test.ts`
  - Responsibility: Prove production behavior and request body contract.
- Modify: `src/app/api/convert/route.ts`
  - Responsibility: Sanitize production request model config before provider execution.
- Modify: `src/app/api/convert/route.test.ts`
  - Responsibility: Prove API route does not accept production request-level secrets/config overrides.
- Modify: `src/features/workspace/workspace-context.tsx`
  - Responsibility: Expose non-sensitive UI mode only; server route remains the enforcement boundary and omits request API Key/Base URL/model in production.
- Modify: `src/features/workspace/workspace-page.tsx`
  - Responsibility: Hide production-sensitive provider fields from normal users.
- Modify: `.env.example`
  - Responsibility: Document server-owned OpenAI-compatible configuration.
- Modify: `README.md`
  - Responsibility: Explain development vs production AI configuration.
- Modify: `docs/production-next-steps.md`
  - Responsibility: Mark P1 scope and keep P2 Responses API migration separate.

## Scope Guard

This PR does not migrate to Responses API, does not add MySQL, does not add Redis, does not add auth/RBAC, and does not add admin provider settings. Those remain later PRs.

### Task 1: Backend production AI policy

**Files:**
- Modify: `src/lib/ai-provider.test.ts`
- Modify: `src/lib/ai-provider.ts`

- [ ] Step 1: Add failing tests for production policy.

Add tests that assert:

```text
1. NODE_ENV=production and no modelConfig uses openai-compatible, not mock.
2. NODE_ENV=production rejects request modelConfig provider mock.
3. Real provider request body includes store:false.
```

- [ ] Step 2: Run targeted test and confirm RED.

Run:

```bash
npm test -- src/lib/ai-provider.test.ts
```

Expected: new tests fail before implementation.

- [ ] Step 3: Implement minimal production policy.

In `convertNovelWithProvider`, resolve provider like this:

```text
production: env.AI_PROVIDER ?? "openai-compatible"
non-production: modelConfig?.provider ?? env.AI_PROVIDER ?? "mock"
```

If production receives request provider `mock`, throw a clear error.

In `convertWithOpenAICompatible`, include `store: false` in the JSON body.

- [ ] Step 4: Run targeted test and confirm GREEN.

Run:

```bash
npm test -- src/lib/ai-provider.test.ts
```

Expected: pass.

### Task 2: API route production request sanitization

**Files:**
- Modify: `src/app/api/convert/route.test.ts`
- Modify: `src/app/api/convert/route.ts`

- [ ] Step 1: Add failing route tests.

Add tests that set `process.env.NODE_ENV` to production and assert:

```text
1. request apiKey/baseUrl/model do not override env values.
2. request provider mock returns a production-only error.
```

- [ ] Step 2: Run route tests and confirm RED.

Run:

```bash
npm test -- src/app/api/convert/route.test.ts
```

Expected: new tests fail before implementation.

- [ ] Step 3: Implement config sanitization helper.

In route or a small helper, when production, pass only safe fields to provider:

```text
provider is allowed only when it is openai-compatible
apiKey/baseUrl/model are ignored in production
```

- [ ] Step 4: Run route tests and confirm GREEN.

Run:

```bash
npm test -- src/app/api/convert/route.test.ts
```

Expected: pass.

### Task 3: Frontend production UI behavior

**Files:**
- Modify: `src/features/workspace/workspace-context.tsx`
- Modify: `src/features/workspace/workspace-page.tsx`
- Modify or create tests under `src/features/workspace/*test.ts`

- [ ] Step 1: Add tests for production request config building if there is an existing helper seam.

If no helper seam exists, extract a pure helper from `WorkspaceProvider` for building request model config and test it.

Expected helper behavior:

```text
production: { provider: "openai-compatible", temperature }
development: includes baseUrl/model/apiKey when present
```

- [ ] Step 2: Run targeted tests and confirm RED.

Run the relevant workspace test file.

- [ ] Step 3: Implement minimal helper and UI conditional.

Hide Base URL, Model fetch, and API Key fields in production. Keep model display text and temperature.

- [ ] Step 4: Run targeted tests and confirm GREEN.

### Task 4: Docs and env alignment

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/production-next-steps.md`

- [ ] Step 1: Update docs.

Document:

```text
production uses server-owned OPENAI_COMPATIBLE_API_KEY
request API Key is development-only
gpt-5.5 is the target production model
Responses API migration is P2, not this PR
```

- [ ] Step 2: Search docs for stale default model claims.

Run:

```powershell
rg -n "gpt-4\.1-mini|一次性 API Key|Chat Completions" README.md .env.example docs/production-next-steps.md
```

Expected: any remaining occurrences are explicitly described as development/current-implementation notes, not production target defaults.

### Task 5: Full verification

**Files:** all changed files.

- [ ] Step 1: Run full tests.

```bash
npm test
```

- [ ] Step 2: Run lint.

```bash
npm run lint
```

- [ ] Step 3: Run build.

```bash
npm run build
```

- [ ] Step 4: Inspect diff.

```bash
git status --short
git diff --stat
```

Expected: only P1 production AI config and docs changes.

## Self-Review

- Spec coverage: Covers production real AI, server-owned key, production mock ban, request override sanitization, frontend hiding of sensitive fields, and docs alignment.
- Placeholder scan: No placeholder sections.
- Type consistency: `ProviderName`, `RequestModelConfig`, and workspace helper outputs remain aligned with existing types.
