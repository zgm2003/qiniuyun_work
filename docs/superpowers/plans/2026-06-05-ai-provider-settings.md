# P6 AI Provider Settings Implementation Plan

> 精简执行版。不要再扩成长篇模板；每个任务只保留文件、目标、验证命令。

**Goal:** 把生产 AI provider/model/API Key 从 env-only 改为数据库优先、API Key 加密入库，同时保留 `/api/convert`、YAML Schema、mock demo 和 env fallback。

**Architecture:** 数据结构先行：`ai_providers` 表保存供应商和加密 Key，`ai_provider_models` 表保存模型。运行时只通过 server-only resolver 得到 `{ apiKey, baseUrl, model }`，`convertWithOpenAICompatible/Responses` 不知道数据库表。

**Tech Stack:** Next.js App Router, TypeScript, Vitest, MySQL, mysql2, Node crypto AES-256-GCM.

---

## Task 1: Schema

**Files**
- Modify: `src/lib/db/schema.sql`
- Modify: `src/lib/db/schema.test.ts`

**Work**
- Add `ai_providers`.
- Add `ai_provider_models` with `ON DELETE CASCADE`.
- Keep UUID `VARCHAR(36)` style to match existing tables.
- Add runtime lookup indexes from spec.

**Verify**
```bash
npm test -- src/lib/db/schema.test.ts
```

---

## Task 2: Secret encryption

**Files**
- Create: `src/lib/server/secret-encryption.ts`
- Create: `src/lib/server/secret-encryption.test.ts`

**Work**
- Implement AES-256-GCM.
- `AI_CONFIG_MASTER_KEY` must be base64 and decode to exactly 32 bytes.
- Empty plaintext fails loudly.
- Return base64 `ciphertext`, `iv`, `authTag`, `version: 1`.
- Do not use `|| ""` to hide missing secrets.

**Verify**
```bash
npm test -- src/lib/server/secret-encryption.test.ts
```

---

## Task 3: Server-only provider settings service

**Files**
- Create: `src/lib/server/ai-provider-settings.ts`
- Create: `src/lib/server/ai-provider-settings.test.ts`

**Work**
- Implement:
  - `saveAIProviderSettings`
  - `listAIProviderSettings`
  - `getAIProviderSettings`
  - `resolveRuntimeAIProviderConfig`
  - `refreshAIProviderModels`
  - `checkAIProviderHealth`
- Views must expose `hasApiKey`, never expose plaintext/ciphertext/iv/authTag.
- Resolver reads default enabled provider + default enabled model.
- If DB has no usable config or query fails, fall back to env.
- If env also lacks key, keep existing error: `OPENAI_COMPATIBLE_API_KEY 未配置`.

**Verify**
```bash
npm test -- src/lib/server/ai-provider-settings.test.ts
```

---

## Task 4: Runtime integration

**Files**
- Modify: `src/lib/ai-provider.ts`
- Modify: `src/lib/ai-provider.test.ts`
- Modify: `src/app/api/convert/route.test.ts`

**Work**
- Introduce internal resolved config for OpenAI-compatible calls.
- Development/test request `modelConfig` can still override.
- Production ignores browser `apiKey/baseUrl/model`, then uses DB resolver, then env fallback.
- Keep `/api/convert` request/response unchanged.
- Do not change YAML Schema or prompt template keys.

**Verify**
```bash
npm test -- src/lib/ai-provider.test.ts src/app/api/convert/route.test.ts
```

---

## Task 5: Model refresh and health behavior

**Files**
- Covered mainly in `src/lib/server/ai-provider-settings.ts`
- Covered by `src/lib/server/ai-provider-settings.test.ts`

**Work**
- `refreshAIProviderModels` calls `/models`, upserts new model rows, keeps existing `enabled/is_default`.
- `checkAIProviderHealth` writes `healthy` on success.
- On failure, writes `unhealthy` and short `health_message`; do not store full response body or secrets.

**Verify**
```bash
npm test -- src/lib/server/ai-provider-settings.test.ts
```

---

## Task 6: Full verification

**Commands**
```bash
npm test
npm run lint
npm run build
```

**Must remain true**
- `/api/convert` contract unchanged.
- Existing mock demo still works.
- Existing env-only production config still works.
- API Key never appears in safe views or DB query params except encrypted fields.
- YAML output contract unchanged.

---

## Implementation order

1. Schema tests fail, then schema passes.
2. Encryption tests fail, then encryption passes.
3. Provider settings service tests fail, then service passes.
4. Runtime integration tests fail, then provider route tests pass.
5. Full verification.

No extra UI. No account system. No Redis. No provider strategy abstraction.
