# P4 Auth Project Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login, HttpOnly cookie sessions, user-owned server projects, and a project list/load flow while preserving the existing题目三 novel-to-YAML demo for unauthenticated users.

**Architecture:** Keep authentication in small server-side modules, keep project ownership checks in `src/lib/server/projects.ts`, and keep UI integration as an enhancement to the existing workspace context. MySQL remains the persistence layer; localStorage drafts and `/api/convert` remain usable without login.

**Tech Stack:** Next.js App Router and Route Handlers, TypeScript, Vitest, Zod, mysql2, MySQL InnoDB, Node `crypto`, HttpOnly cookies.

---

## Scope Guard

This plan implements P4 only. It does not implement Prompt template storage, AI provider encrypted key storage, RBAC, admin pages, Redis, OAuth, team collaboration, async conversion jobs, or scene/dialogue table decomposition. The题目三 YAML output contract must remain unchanged.

## File Structure

- Modify `src/lib/db/schema.sql`: add `users`, `sessions`, and `projects.owner_user_id`.
- Create `src/lib/auth/password.ts`: email normalization, password hash, password verification.
- Create `src/lib/auth/session.ts`: session token/hash helpers and cookie constants.
- Create `src/lib/server/auth.ts`: register, login, logout, current-user service functions.
- Modify `src/lib/server/projects.ts`: add owner-aware create/list/get/update/version/run functions.
- Create `src/app/api/_auth.ts`: route helper for current user.
- Create `src/app/api/auth/register/route.ts`, `login/route.ts`, `logout/route.ts`, `me/route.ts`.
- Modify `src/app/api/projects/route.ts`: add `GET`, attach owner on authenticated `POST`.
- Create `src/app/api/projects/[projectId]/route.ts`: project detail `GET` and source update `PATCH`.
- Modify `src/app/api/projects/[projectId]/versions/route.ts` and `generation-runs/route.ts`: owner checks.
- Create `src/features/auth/*`: auth API client and login/register forms.
- Create `src/app/(auth)/login/page.tsx` and `src/app/(auth)/register/page.tsx`.
- Create `src/features/workspace/server-projects-client.ts` and `projects-page.tsx`.
- Create `src/app/(workbench)/projects/page.tsx`.
- Modify `src/features/workspace/workbench-nav.ts`, `workbench-shell.tsx`, `workspace-context.tsx`.
- Modify `README.md`, `docs/production-next-steps.md`, `docs/pr-plan.md`.

---

## Task 1: Extend MySQL schema for auth and ownership

**Files:**
- Modify: `src/lib/db/schema.sql`
- Modify: `src/lib/db/schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add tests that assert the schema contains `users`, `sessions`, `token_hash CHAR(64)`, `owner_user_id VARCHAR(36) NULL`, and owner/session foreign keys.

Run:

```bash
npm test -- src/lib/db/schema.test.ts
```

Expected: FAIL before schema changes.

- [ ] **Step 2: Add schema SQL**

Add before `projects`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_sessions_token_hash (token_hash),
  KEY idx_sessions_user_expires (user_id, expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Change `projects` to include:

```sql
owner_user_id VARCHAR(36) NULL,
KEY idx_projects_owner_updated (owner_user_id, updated_at),
CONSTRAINT fk_projects_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
```

- [ ] **Step 3: Verify schema tests pass and commit**

Run:

```bash
npm test -- src/lib/db/schema.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/db/schema.sql src/lib/db/schema.test.ts
git commit -m "feat: add auth persistence schema"
```

---

## Task 2: Add password and session primitives

**Files:**
- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/password.test.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/session.test.ts`

- [ ] **Step 1: Write failing primitive tests**

`password.test.ts` must prove:

```ts
expect(normalizeEmail("  Author@Example.COM  ")).toBe("author@example.com");
const hash = await hashPassword("long-password");
expect(hash).toMatch(/^scrypt:v1:/);
expect(hash).not.toContain("long-password");
expect(await verifyPassword("long-password", hash)).toBe(true);
expect(await verifyPassword("bad-password", hash)).toBe(false);
```

`session.test.ts` must prove:

```ts
expect(hashSessionToken("token-value")).toMatch(/^[a-f0-9]{64}$/);
expect(SESSION_COOKIE_NAME).toBe("qiniuyun_session");
expect(buildSessionCookieOptions("production")).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
```

Run:

```bash
npm test -- src/lib/auth/password.test.ts src/lib/auth/session.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 2: Implement `password.ts`**

```ts
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_PREFIX = "scrypt:v1";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("邮箱不能为空");
  return normalized;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) throw new Error("密码至少需要 8 个字符");
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${PASSWORD_PREFIX}:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, version, saltText, keyText] = storedHash.split(":");
  if (`${algorithm}:${version}` !== PASSWORD_PREFIX || !saltText || !keyText) return false;
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(keyText, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

- [ ] **Step 3: Implement `session.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "qiniuyun_session";
export const SESSION_TTL_DAYS = 30;
export type RuntimeEnvironment = "production" | "development" | "test";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function buildSessionCookieOptions(nodeEnv: RuntimeEnvironment) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60
  };
}
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test -- src/lib/auth/password.test.ts src/lib/auth/session.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/auth
git commit -m "feat: add auth crypto primitives"
```

---

## Task 3: Add auth service

**Files:**
- Create: `src/lib/server/auth.ts`
- Create: `src/lib/server/auth.test.ts`

- [ ] **Step 1: Write failing auth service tests**

Create `src/lib/server/auth.test.ts` with a fake `MysqlQueryRunner`. It must cover registration, normalized login, wrong password rejection, session lookup, and logout:

```ts
import { describe, expect, it } from "vitest";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { hashSessionToken } from "@/lib/auth/session";
import { createUser, getUserBySessionToken, loginUser, logoutSession } from "./auth";

class FakeAuthDb implements MysqlQueryRunner {
  users: Array<{ id: string; email: string; password_hash: string; name: string; status: "active" | "disabled"; created_at: Date; updated_at: Date }> = [];
  sessions: Array<{ id: string; user_id: string; token_hash: string; expires_at: Date; created_at: Date }> = [];

  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(sql: string, values: unknown[] = []): Promise<[T, ...unknown[]]> {
    if (sql.includes("INSERT INTO users")) {
      const [id, email, passwordHash, name, status, createdAt, updatedAt] = values as [string, string, string, string, "active", Date, Date];
      if (this.users.some((user) => user.email === email)) throw new Error("Duplicate entry");
      this.users.push({ id, email, password_hash: passwordHash, name, status, created_at: createdAt, updated_at: updatedAt });
      return [{ affectedRows: 1 } as ResultSetHeader as T];
    }

    if (sql.includes("FROM users") && sql.includes("WHERE email = ?")) {
      const [email] = values as [string];
      return [this.users.filter((user) => user.email === email) as RowDataPacket[] as T];
    }

    if (sql.includes("INSERT INTO sessions")) {
      const [id, userId, tokenHash, expiresAt, createdAt] = values as [string, string, string, Date, Date];
      this.sessions.push({ id, user_id: userId, token_hash: tokenHash, expires_at: expiresAt, created_at: createdAt });
      return [{ affectedRows: 1 } as ResultSetHeader as T];
    }

    if (sql.includes("FROM sessions") && sql.includes("token_hash = ?")) {
      const [tokenHash, now] = values as [string, Date];
      const session = this.sessions.find((item) => item.token_hash === tokenHash && item.expires_at > now);
      const user = session ? this.users.find((item) => item.id === session.user_id && item.status === "active") : undefined;
      return [(user ? [{ id: user.id, email: user.email, name: user.name }] : []) as RowDataPacket[] as T];
    }

    if (sql.includes("DELETE FROM sessions") && sql.includes("token_hash = ?")) {
      const [tokenHash] = values as [string];
      this.sessions = this.sessions.filter((session) => session.token_hash !== tokenHash);
      return [{ affectedRows: 1 } as ResultSetHeader as T];
    }

    throw new Error(`Unhandled SQL: ${sql}`);
  }
}

describe("auth service", () => {
  it("registers a user and stores only password/session hashes", async () => {
    const db = new FakeAuthDb();
    const result = await createUser({ email: " Author@Example.COM ", password: "long-password", name: "作者" }, db);
    expect(result.user).toMatchObject({ email: "author@example.com", name: "作者" });
    expect(result.sessionToken).toHaveLength(43);
    expect(db.users[0].password_hash).not.toContain("long-password");
    expect(db.sessions[0].token_hash).toBe(hashSessionToken(result.sessionToken));
  });

  it("logs in with normalized email and rejects wrong password", async () => {
    const db = new FakeAuthDb();
    await createUser({ email: "author@example.com", password: "long-password", name: "作者" }, db);
    await expect(loginUser({ email: "AUTHOR@example.com", password: "long-password" }, db)).resolves.toMatchObject({ user: { email: "author@example.com" } });
    await expect(loginUser({ email: "author@example.com", password: "bad-password" }, db)).rejects.toThrow("邮箱或密码错误");
  });

  it("resolves and deletes sessions by raw token", async () => {
    const db = new FakeAuthDb();
    const created = await createUser({ email: "author@example.com", password: "long-password", name: "作者" }, db);
    await expect(getUserBySessionToken(created.sessionToken, db)).resolves.toMatchObject({ email: "author@example.com" });
    await logoutSession(created.sessionToken, db);
    await expect(getUserBySessionToken(created.sessionToken, db)).resolves.toBeNull();
  });
});
```

Run:

```bash
npm test -- src/lib/server/auth.test.ts
```

Expected: FAIL because `src/lib/server/auth.ts` does not exist.

- [ ] **Step 2: Implement `src/lib/server/auth.ts`**

```ts
import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { getMysqlPool } from "@/lib/db/mysql";
import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, hashSessionToken, sessionExpiresAt } from "@/lib/auth/session";

export type UserSummary = { id: string; email: string; name: string };
export type CreateUserInput = { email: string; password: string; name?: string };
export type LoginInput = { email: string; password: string };

type UserRow = RowDataPacket & { id: string; email: string; password_hash: string; name: string; status: "active" | "disabled" };
type SessionUserRow = RowDataPacket & UserSummary;

function resolveRunner(runner?: MysqlQueryRunner): MysqlQueryRunner {
  return runner ?? getMysqlPool();
}

function defaultName(email: string, name?: string): string {
  const trimmed = name?.trim();
  return trimmed || email.split("@")[0];
}

async function createSession(userId: string, runner: MysqlQueryRunner): Promise<string> {
  const token = createSessionToken();
  const now = new Date();
  await runner.query<ResultSetHeader>(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), userId, hashSessionToken(token), sessionExpiresAt(now), now]
  );
  return token;
}

export async function createUser(input: CreateUserInput, runner?: MysqlQueryRunner): Promise<{ user: UserSummary; sessionToken: string }> {
  const db = resolveRunner(runner);
  const email = normalizeEmail(input.email);
  const id = randomUUID();
  const name = defaultName(email, input.name);
  const now = new Date();
  const passwordHash = await hashPassword(input.password);

  try {
    await db.query<ResultSetHeader>(
      `INSERT INTO users (id, email, password_hash, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, email, passwordHash, name, "active", now, now]
    );
  } catch {
    throw new Error("邮箱已被注册");
  }

  return { user: { id, email, name }, sessionToken: await createSession(id, db) };
}

export async function loginUser(input: LoginInput, runner?: MysqlQueryRunner): Promise<{ user: UserSummary; sessionToken: string }> {
  const db = resolveRunner(runner);
  const email = normalizeEmail(input.email);
  const [rows] = await db.query<UserRow[]>(
    `SELECT id, email, password_hash, name, status FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  const user = rows[0];
  if (!user) throw new Error("邮箱或密码错误");
  if (user.status !== "active") throw new Error("账号不可用");
  if (!(await verifyPassword(input.password, user.password_hash))) throw new Error("邮箱或密码错误");
  return { user: { id: user.id, email: user.email, name: user.name }, sessionToken: await createSession(user.id, db) };
}

export async function getUserBySessionToken(token: string | undefined, runner?: MysqlQueryRunner): Promise<UserSummary | null> {
  if (!token) return null;
  const [rows] = await resolveRunner(runner).query<SessionUserRow[]>(
    `SELECT users.id, users.email, users.name
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.status = 'active'
     LIMIT 1`,
    [hashSessionToken(token), new Date()]
  );
  return rows[0] ? { id: rows[0].id, email: rows[0].email, name: rows[0].name } : null;
}

export async function logoutSession(token: string | undefined, runner?: MysqlQueryRunner): Promise<void> {
  if (!token) return;
  await resolveRunner(runner).query<ResultSetHeader>(`DELETE FROM sessions WHERE token_hash = ?`, [hashSessionToken(token)]);
}
```

- [ ] **Step 3: Verify and commit**

Run:

```bash
npm test -- src/lib/server/auth.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/server/auth.ts src/lib/server/auth.test.ts
git commit -m "feat: add auth service"
```

---

## Task 4: Add auth route handlers

**Files:**
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/me/route.ts`
- Create: matching `route.test.ts` files

- [ ] **Step 1: Write failing route tests**

Tests must prove:

```ts
// register/login
expect(response.status).toBe(201); // register
expect(response.status).toBe(200); // login
expect(response.headers.get("set-cookie")).toContain("qiniuyun_session=session-token");
expect(await response.json()).toEqual({ user: { id: "user-1", email: "author@example.com", name: "作者" } });

// me
expect(await response.json()).toEqual({ user: { id: "user-1", email: "author@example.com", name: "作者" } });

// logout
expect(response.headers.get("set-cookie")).toContain("qiniuyun_session=");
expect(await response.json()).toEqual({ ok: true });
```

Run:

```bash
npm test -- src/app/api/auth/register/route.test.ts src/app/api/auth/login/route.test.ts src/app/api/auth/me/route.test.ts src/app/api/auth/logout/route.test.ts
```

Expected: FAIL because routes do not exist.

- [ ] **Step 2: Implement register route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { createUser } from "@/lib/server/auth";

const RegisterRequestSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少需要 8 个字符"),
  name: z.string().optional()
});

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 }); }
  const parsed = RegisterRequestSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const result = await createUser(parsed.data);
    const response = NextResponse.json({ user: result.user }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, buildSessionCookieOptions(process.env.NODE_ENV as "production" | "development" | "test"));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "注册失败" }, { status: 400 });
  }
}
```

- [ ] **Step 3: Implement login/logout/me routes**

`login/route.ts` mirrors register but calls `loginUser` and returns status 200.

`logout/route.ts`:

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { logoutSession } from "@/lib/server/auth";

export async function POST() {
  const cookieStore = await cookies();
  await logoutSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
```

`me/route.ts`:

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getUserBySessionToken } from "@/lib/server/auth";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getUserBySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  return NextResponse.json({ user });
}
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test -- src/app/api/auth/register/route.test.ts src/app/api/auth/login/route.test.ts src/app/api/auth/me/route.test.ts src/app/api/auth/logout/route.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/app/api/auth
git commit -m "feat: add auth api routes"
```

---

## Task 5: Make project services owner-aware

**Files:**
- Modify: `src/lib/server/projects.ts`
- Modify: `src/lib/server/projects.test.ts`

- [ ] **Step 1: Add failing service tests for owner isolation**

Add tests proving:

```ts
const userAProject = await createProject({ title: "用户 A 项目", sourceText: "原文 A", ownerUserId: "user-a" }, db);
await createProject({ title: "用户 B 项目", sourceText: "原文 B", ownerUserId: "user-b" }, db);
expect(await listProjectsForUser("user-a", db)).toHaveLength(1);
expect(await getProjectForUser(userAProject.id, "user-b", db)).toBeNull();
await expect(updateProjectForUser({ projectId: userAProject.id, ownerUserId: "user-b", title: "坏更新", sourceText: "坏正文" }, db)).rejects.toThrow("项目不存在");
```

Run:

```bash
npm test -- src/lib/server/projects.test.ts
```

Expected: FAIL before owner-aware APIs exist.

- [ ] **Step 2: Extend project service types**

Add/modify types in `src/lib/server/projects.ts`:

```ts
export type ProjectRecord = {
  id: string;
  ownerUserId: string | null;
  title: string;
  sourceText: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListItem = Pick<ProjectRecord, "id" | "title" | "status" | "createdAt" | "updatedAt">;

export type ProjectDetail = ProjectRecord & {
  latestVersion: ScriptVersionRecord | null;
};

export type CreateProjectInput = {
  title: string;
  sourceText: string;
  ownerUserId?: string | null;
};

export type UpdateProjectInput = {
  projectId: string;
  ownerUserId: string;
  title: string;
  sourceText: string;
};
```

- [ ] **Step 3: Save optional owner in `createProject`**

Change insert SQL to include owner:

```ts
const ownerUserId = input.ownerUserId ?? null;
await resolveRunner(runner).query<ResultSetHeader>(
  `INSERT INTO projects (id, owner_user_id, title, source_text, status, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [id, ownerUserId, title, sourceText, status, createdAtDate, createdAtDate]
);
```

Return `ownerUserId` in `ProjectRecord`.

- [ ] **Step 4: Add list/get/update functions**

Add owner-filtered functions:

```ts
export async function listProjectsForUser(ownerUserId: string, runner?: MysqlQueryRunner): Promise<ProjectListItem[]> {
  const userId = requireTrimmed(ownerUserId, "ownerUserId 不能为空");
  const [rows] = await resolveRunner(runner).query<ProjectRow[]>(
    `SELECT id, owner_user_id, title, source_text, status, created_at, updated_at
     FROM projects
     WHERE owner_user_id = ?
     ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map(mapProjectRow).map(({ id, title, status, createdAt, updatedAt }) => ({ id, title, status, createdAt, updatedAt }));
}

export async function getProjectForUser(projectId: string, ownerUserId: string, runner?: MysqlQueryRunner): Promise<ProjectDetail | null> {
  const [rows] = await resolveRunner(runner).query<ProjectRow[]>(
    `SELECT id, owner_user_id, title, source_text, status, created_at, updated_at
     FROM projects
     WHERE id = ? AND owner_user_id = ?
     LIMIT 1`,
    [requireTrimmed(projectId, "projectId 不能为空"), requireTrimmed(ownerUserId, "ownerUserId 不能为空")]
  );
  if (!rows[0]) return null;
  return { ...mapProjectRow(rows[0]), latestVersion: null };
}

export async function updateProjectForUser(input: UpdateProjectInput, runner?: MysqlQueryRunner): Promise<ProjectRecord> {
  const projectId = requireTrimmed(input.projectId, "projectId 不能为空");
  const ownerUserId = requireTrimmed(input.ownerUserId, "ownerUserId 不能为空");
  const title = requireTrimmed(input.title, "标题不能为空");
  const sourceText = requireNonBlank(input.sourceText, "小说正文不能为空");
  const updatedAtDate = new Date();
  const [result] = await resolveRunner(runner).query<ResultSetHeader>(
    `UPDATE projects SET title = ?, source_text = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?`,
    [title, sourceText, updatedAtDate, projectId, ownerUserId]
  );
  if (result.affectedRows !== 1) throw new Error("项目不存在");
  const detail = await getProjectForUser(projectId, ownerUserId, runner);
  if (!detail) throw new Error("项目不存在");
  return detail;
}
```

- [ ] **Step 5: Gate version/run writes for owned projects**

Add optional `ownerUserId?: string` to `CreateScriptVersionInput` and `RecordGenerationRunInput`. If present, verify `project_id + owner_user_id` exists before inserting. If not found, throw `项目不存在`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test -- src/lib/server/projects.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/server/projects.ts src/lib/server/projects.test.ts
git commit -m "feat: enforce project ownership in services"
```

---

## Task 6: Add owner-aware project API routes

**Files:**
- Create: `src/app/api/_auth.ts`
- Modify: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[projectId]/route.ts`
- Modify: `src/app/api/projects/[projectId]/versions/route.ts`
- Modify: `src/app/api/projects/[projectId]/generation-runs/route.ts`
- Modify/create matching route tests

- [ ] **Step 1: Add route auth helper**

Create `src/app/api/_auth.ts`:

```ts
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getUserBySessionToken, type UserSummary } from "@/lib/server/auth";

export async function readCurrentUser(): Promise<UserSummary | null> {
  const cookieStore = await cookies();
  return getUserBySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
```

- [ ] **Step 2: Write failing route tests**

Tests must prove:

```ts
expect(await projectsGetWhenLoggedOut()).toHaveProperty("status", 401);
expect(createProject).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: "user-1" }));
expect(await detailForOtherUser()).toHaveProperty("status", 404);
expect(createScriptVersion).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: "user-1" }));
expect(recordGenerationRun).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: "user-1" }));
```

Run focused route tests. Expected: FAIL before implementation.

- [ ] **Step 3: Add `GET /api/projects` and owner-aware `POST`**

In `src/app/api/projects/route.ts`:

```ts
export async function GET() {
  const user = await readCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const projects = await listProjectsForUser(user.id);
  return NextResponse.json({ projects });
}
```

Inside `POST`, read current user and pass `ownerUserId: user?.id ?? null` to `createProject`.

- [ ] **Step 4: Add `GET/PATCH /api/projects/[projectId]`**

Create `src/app/api/projects/[projectId]/route.ts` with login required. `GET` returns 401 when no user, 404 when project is absent or owned by another user. `PATCH` validates `{ title, sourceText }` and calls `updateProjectForUser`.

- [ ] **Step 5: Pass owner into version/run routes**

In `versions/route.ts` and `generation-runs/route.ts`, call `readCurrentUser()` and pass `ownerUserId: user?.id`. If the service throws `项目不存在`, return 404.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test -- src/app/api/projects/route.test.ts src/app/api/projects/[projectId]/route.test.ts src/app/api/projects/[projectId]/versions/route.test.ts src/app/api/projects/[projectId]/generation-runs/route.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/app/api/_auth.ts src/app/api/projects
git commit -m "feat: add owner-aware project api"
```

---

## Task 7: Add auth pages and current-user UI

**Files:**
- Create: `src/features/auth/auth-client.ts`
- Create: `src/features/auth/auth-forms.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`
- Modify: `src/features/workspace/workbench-shell.tsx`

- [ ] **Step 1: Add auth API client**

Create helper functions: `fetchCurrentUser`, `login`, `register`, `logout`. Each function must parse JSON and throw the server `error` message when response is not OK.

- [ ] **Step 2: Add login/register form**

Create `AuthForm` with `mode: "login" | "register"`, fields for email/password and optional name, an error paragraph, and redirect to `/projects` after success.

- [ ] **Step 3: Add pages**

`src/app/(auth)/login/page.tsx`:

```tsx
import { AuthForm } from "@/features/auth/auth-forms";
export default function LoginPage() { return <AuthForm mode="login" />; }
```

`src/app/(auth)/register/page.tsx`:

```tsx
import { AuthForm } from "@/features/auth/auth-forms";
export default function RegisterPage() { return <AuthForm mode="register" />; }
```

- [ ] **Step 4: Show auth status in shell**

In `WorkbenchShell`, fetch current user in `useEffect`. If present, show email and logout button. If absent, show `/login` and `/register`. Do not block workspace rendering.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/features/workspace/workbench-nav.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/features/auth src/app/(auth) src/features/workspace/workbench-shell.tsx
git commit -m "feat: add auth pages"
```

---

## Task 8: Add server project list/load/save UI

**Files:**
- Create: `src/features/workspace/server-projects-client.ts`
- Create: `src/features/workspace/projects-page.tsx`
- Create: `src/app/(workbench)/projects/page.tsx`
- Modify: `src/features/workspace/workbench-nav.ts`
- Modify: `src/features/workspace/workspace-context.tsx`

- [ ] **Step 1: Update nav test first**

Modify `workbench-nav.test.ts` to expect `/projects` between `/script` and `/drafts`.

Run:

```bash
npm test -- src/features/workspace/workbench-nav.test.ts
```

Expected: FAIL before nav update.

- [ ] **Step 2: Add `/projects` nav item**

Update `WorkbenchRoute` and `WORKBENCH_NAV_ITEMS`:

```ts
{ href: "/projects", label: "服务端项目", description: "登录后保存、加载自己的小说改编项目" }
```

- [ ] **Step 3: Add server project browser client**

Create helpers: `listServerProjects`, `loadServerProject`, `createServerProject`, `updateServerProject`, `saveServerScriptVersion`. These helpers must never send API Key, Base URL, provider, or temperature.

- [ ] **Step 4: Extend `WorkspaceContext` minimally**

Add:

```ts
serverProjectId: string | null;
serverProjectMessage: string;
loadServerProjectIntoWorkspace: (project: ServerProjectDetail) => void;
saveCurrentWorkspaceToServer: () => Promise<void>;
```

Rules:

```text
If serverProjectId is null: POST /api/projects.
If serverProjectId exists: PATCH /api/projects/[id].
If YAML is valid and report exists: POST /api/projects/[id]/versions.
If save fails: set error/message; do not clear title, novelText, yamlText, or report.
```

- [ ] **Step 5: Create `ProjectsPage`**

Create a simple client page that loads `/api/projects`, shows login/error message on 401, lists project title/status/updatedAt, has “保存当前工作区” and “打开” buttons.

- [ ] **Step 6: Add route file**

`src/app/(workbench)/projects/page.tsx`:

```tsx
import { ProjectsPage } from "@/features/workspace/projects-page";
export default function ProjectsRoute() { return <ProjectsPage />; }
```

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm test -- src/features/workspace/workbench-nav.test.ts src/features/workspace/workspace-page.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/features/workspace/server-projects-client.ts src/features/workspace/projects-page.tsx src/app/(workbench)/projects/page.tsx src/features/workspace/workbench-nav.ts src/features/workspace/workspace-context.tsx src/features/workspace/workbench-nav.test.ts
git commit -m "feat: add server project workspace"
```

---

## Task 9: Update docs

**Files:**
- Modify: `README.md`
- Modify: `docs/production-next-steps.md`
- Modify: `docs/pr-plan.md`

- [ ] **Step 1: README**

After implementation, document that P4 adds login and service-side projects while unauthenticated题目三 demo remains available. Do not claim P4 exists before implementation.

- [ ] **Step 2: Roadmap**

Ensure order is:

```text
P4 登录、会话、用户隔离、服务端项目列表
P5 Prompt 模板化
P6 AI 供应商配置加密入库
P7 简单 RBAC 和管理端骨架
P8 Redis 与异步任务
```

- [ ] **Step 3: PR plan**

Add PR 16:

```md
### PR 16：登录、用户隔离和服务端项目列表

目标：让作者登录后保存和恢复自己的小说改编项目，不破坏未登录演示流程。

验收：
- 未登录仍可完成小说转 YAML 剧本、编辑、校验、导出。
- 登录用户可以保存当前工作区到服务端。
- `/projects` 只展示当前用户项目。
- 用户不能加载或写入其他用户项目。
```

- [ ] **Step 4: Commit**

```bash
git add README.md docs/production-next-steps.md docs/pr-plan.md
git commit -m "docs: document auth project roadmap"
```

---

## Task 10: Final verification

**Files:**
- All files touched in Tasks 1-9.

- [ ] **Step 1: Full tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no ESLint errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Manual smoke**

```bash
npm run dev
```

Verify:

```text
1. Without logging in, /workspace can still load sample, convert, edit YAML, validate, and export.
2. Register a user.
3. Save current workspace to server.
4. Open /projects and see only that user's project.
5. Open the project and confirm title, novel text, YAML, and report return to the workspace.
6. Log out and confirm /projects asks for login while /workspace still works.
```

---

## Self-Review Checklist

- P4 preserves the题目三 YAML conversion flow for unauthenticated users.
- P4 does not implement Prompt template storage or AI Key storage.
- Project list is owner-filtered on the server, not just hidden in UI.
- Password hashes and session hashes never expose plaintext secrets.
- localStorage drafts remain available.
- API Key, Base URL, provider, and temperature are not saved into projects.
- Full verification requires `npm test`, `npm run lint`, and `npm run build`.
