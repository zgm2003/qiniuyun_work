# MySQL Persistence Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first production MySQL persistence layer for projects, YAML script versions, and generation run records without replacing localStorage or adding Redis/Auth/RBAC.

**Architecture:** Keep SQL isolated in a small database adapter, keep business rules in `src/lib/server/projects.ts`, and keep API routes as validation/response wrappers. Use current YAML Schema as the hard contract and store whole YAML versions instead of prematurely splitting scenes/dialogue/characters.

**Tech Stack:** Next.js API routes, TypeScript, Vitest, Zod, mysql2, MySQL InnoDB.

---

## File Structure

- Create `src/lib/db/mysql.ts`: DSN parsing, pool creation, query helper types.
- Create `src/lib/db/mysql.test.ts`: pure tests for DSN parsing and pool config.
- Create `src/lib/db/schema.sql`: MySQL initialization SQL for `projects`, `script_versions`, `generation_runs`.
- Create `src/lib/server/projects.ts`: service functions for project creation, version creation, and generation run recording.
- Create `src/lib/server/projects.test.ts`: fake database tests for service behavior.
- Create `src/app/api/projects/route.ts`: `POST /api/projects`.
- Create `src/app/api/projects/route.test.ts`: API tests with mocked service.
- Create `src/app/api/projects/[projectId]/versions/route.ts`: `POST /api/projects/[projectId]/versions`.
- Create `src/app/api/projects/[projectId]/versions/route.test.ts`: API tests with mocked service.
- Modify `package.json` / `package-lock.json`: add `mysql2`.
- Modify `.env.example`, `README.md`, `docs/production-next-steps.md`, `docs/pr-plan.md`: document P3 status and env.

---

### Task 1: Add MySQL connection module

**Files:**
- Create: `src/lib/db/mysql.ts`
- Create: `src/lib/db/mysql.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install mysql2**

Run:

```bash
npm install mysql2
```

Expected: `package.json` contains `mysql2` in dependencies and `package-lock.json` updates.

- [ ] **Step 2: Write failing DSN tests**

Create `src/lib/db/mysql.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMysqlDsn } from "./mysql";

describe("parseMysqlDsn", () => {
  it("parses mysql URL DSN", () => {
    expect(parseMysqlDsn("mysql://app:secret@127.0.0.1:3306/qiniuyun")).toMatchObject({
      host: "127.0.0.1",
      port: 3306,
      user: "app",
      password: "secret",
      database: "qiniuyun"
    });
  });

  it("parses Go tcp DSN used by the docker env", () => {
    expect(parseMysqlDsn("root:admin_go_local@tcp(host.docker.internal:3307)/admin?charset=utf8mb4&parseTime=True&loc=Local")).toMatchObject({
      host: "host.docker.internal",
      port: 3307,
      user: "root",
      password: "admin_go_local",
      database: "admin"
    });
  });

  it("rejects unsupported DSN formats instead of guessing", () => {
    expect(() => parseMysqlDsn("not a mysql dsn")).toThrow("MYSQL_DSN 格式不支持");
  });
});
```

- [ ] **Step 3: Run RED**

Run:

```bash
npm test -- src/lib/db/mysql.test.ts
```

Expected: fail because `src/lib/db/mysql.ts` does not exist.

- [ ] **Step 4: Implement `src/lib/db/mysql.ts`**

Add:

```ts
import mysql, { type Pool, type PoolOptions, type RowDataPacket } from "mysql2/promise";

export type MysqlEnvironment = Record<string, string | undefined>;
export type MysqlQueryRunner = {
  query<T extends RowDataPacket[] | RowDataPacket[][] | mysql.ResultSetHeader>(sql: string, values?: readonly unknown[]): Promise<[T]>;
};

let pool: Pool | null = null;

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3306;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("MYSQL_DSN 端口不合法");
  }

  return port;
}

export function parseMysqlDsn(dsn: string): PoolOptions {
  if (dsn.startsWith("mysql://")) {
    const url = new URL(dsn);
    const database = url.pathname.replace(/^\//, "");
    if (!database) {
      throw new Error("MYSQL_DSN 缺少数据库名");
    }

    return {
      host: url.hostname,
      port: parsePort(url.port),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      charset: "utf8mb4"
    };
  }

  const goDsn = dsn.match(/^([^:]+):([^@]*)@tcp\(([^:()]+):(\d+)\)\/([^?]+)(?:\?.*)?$/);
  if (goDsn) {
    return {
      host: goDsn[3],
      port: parsePort(goDsn[4]),
      user: goDsn[1],
      password: goDsn[2],
      database: goDsn[5],
      charset: "utf8mb4"
    };
  }

  throw new Error("MYSQL_DSN 格式不支持");
}

export function buildMysqlPoolOptions(env: MysqlEnvironment): PoolOptions {
  const dsn = env.MYSQL_DSN;
  if (!dsn) {
    throw new Error("MYSQL_DSN 未配置");
  }

  const connectionLimit = Number(env.MYSQL_CONNECTION_LIMIT ?? "10");
  if (!Number.isInteger(connectionLimit) || connectionLimit <= 0) {
    throw new Error("MYSQL_CONNECTION_LIMIT 必须是正整数");
  }

  return {
    ...parseMysqlDsn(dsn),
    waitForConnections: true,
    connectionLimit
  };
}

export function getMysqlPool(env: MysqlEnvironment = process.env): Pool {
  if (!pool) {
    pool = mysql.createPool(buildMysqlPoolOptions(env));
  }

  return pool;
}
```

- [ ] **Step 5: Run GREEN**

Run:

```bash
npm test -- src/lib/db/mysql.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/db/mysql.ts src/lib/db/mysql.test.ts
git commit -m "feat: add mysql connection module"
```

---

### Task 2: Add MySQL schema SQL

**Files:**
- Create: `src/lib/db/schema.sql`
- Create: `src/lib/db/schema.test.ts`

- [ ] **Step 1: Write schema tests**

Create `src/lib/db/schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "src/lib/db/schema.sql"), "utf8");

describe("database schema", () => {
  it("creates the three persistence tables", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS projects");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS script_versions");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS generation_runs");
  });

  it("stores YAML as a whole version instead of splitting screenplay internals", () => {
    expect(schema).toContain("yaml MEDIUMTEXT NOT NULL");
    expect(schema).not.toContain("CREATE TABLE IF NOT EXISTS scenes");
    expect(schema).not.toContain("CREATE TABLE IF NOT EXISTS dialogue");
  });

  it("uses cascading foreign keys for project-owned rows", () => {
    expect(schema).toContain("FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE");
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npm test -- src/lib/db/schema.test.ts
```

Expected: fail because schema file is missing.

- [ ] **Step 3: Add `src/lib/db/schema.sql`**

Use the SQL from `docs/superpowers/specs/2026-06-05-mysql-persistence-design.md` with `CREATE TABLE IF NOT EXISTS`.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- src/lib/db/schema.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.sql src/lib/db/schema.test.ts
git commit -m "feat: add mysql persistence schema"
```

---

### Task 3: Add project persistence service

**Files:**
- Create: `src/lib/server/projects.ts`
- Create: `src/lib/server/projects.test.ts`

- [ ] **Step 1: Write failing service tests**

Tests must prove:

1. Creating a project trims title and inserts `draft` status.
2. Blank title throws `标题不能为空`.
3. Creating a script version rejects invalid YAML before insert.
4. Creating a script version inserts version and updates project status to `generated`.
5. Recording a generation run inserts provider/model/status/error.

Use a fake query runner that records SQL and values.

- [ ] **Step 2: Run RED**

```bash
npm test -- src/lib/server/projects.test.ts
```

Expected: fail because service file is missing.

- [ ] **Step 3: Implement service**

Expose:

```ts
export type ProjectRecord = {
  id: string;
  title: string;
  sourceText: string;
  status: "draft" | "generated" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  title: string;
  sourceText: string;
};

export type CreateScriptVersionInput = {
  projectId: string;
  yaml: string;
  report: ConversionReport;
};

export type RecordGenerationRunInput = {
  projectId: string;
  provider: ProviderName;
  model: string;
  status: "running" | "succeeded" | "failed";
  errorMessage?: string | null;
};
```

Use `crypto.randomUUID()` for IDs. Do not default missing business fields except generated IDs/timestamps.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- src/lib/server/projects.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/projects.ts src/lib/server/projects.test.ts
git commit -m "feat: add project persistence service"
```

---

### Task 4: Add project creation API

**Files:**
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/route.test.ts`

- [ ] **Step 1: Write failing API tests**

Tests must cover:

1. `POST /api/projects` returns 201 and project JSON.
2. invalid JSON returns 400 `请求体必须是 JSON`.
3. blank title returns 400.
4. service failure returns 500 `项目保存失败`.

Mock `@/lib/server/projects`.

- [ ] **Step 2: Run RED**

```bash
npm test -- src/app/api/projects/route.test.ts
```

Expected: fail because route file is missing.

- [ ] **Step 3: Implement route**

Use Zod request schema. Call `createProject`. Do not import MySQL directly in route.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- src/app/api/projects/route.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/projects/route.ts src/app/api/projects/route.test.ts
git commit -m "feat: add project creation api"
```

---

### Task 5: Add script version API

**Files:**
- Create: `src/app/api/projects/[projectId]/versions/route.ts`
- Create: `src/app/api/projects/[projectId]/versions/route.test.ts`

- [ ] **Step 1: Write failing API tests**

Tests must cover:

1. valid YAML returns 201 and version JSON.
2. invalid JSON returns 400 `请求体必须是 JSON`.
3. invalid YAML returns 400 with Schema error text.
4. service failure returns 500 `剧本版本保存失败`.

Mock `@/lib/server/projects`.

- [ ] **Step 2: Run RED**

```bash
npm test -- src/app/api/projects/[projectId]/versions/route.test.ts
```

Expected: fail because route file is missing.

- [ ] **Step 3: Implement route**

Accept Next.js route context params as `Promise<{ projectId: string }>` if required by current Next version. Validate YAML through service, not route.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- src/app/api/projects/[projectId]/versions/route.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/projects/[projectId]/versions/route.ts src/app/api/projects/[projectId]/versions/route.test.ts
git commit -m "feat: add script version api"
```

---

### Task 6: Update docs and env

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/production-next-steps.md`
- Modify: `docs/pr-plan.md`

- [ ] **Step 1: Update `.env.example`**

Add:

```env
MYSQL_DSN=mysql://app_user:app_password@127.0.0.1:3306/qiniuyun
MYSQL_CONNECTION_LIMIT=10
```

- [ ] **Step 2: Update README**

Document:

- P3 has MySQL foundation.
- `src/lib/db/schema.sql` initializes tables.
- localStorage drafts remain for browser draft workflow.
- Redis/Auth/RBAC are still later phases.

- [ ] **Step 3: Update production roadmap**

Mark P3 implemented as foundation only. Keep Redis in P7.

- [ ] **Step 4: Update PR plan**

Add P3 row under productized progress.

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md docs/production-next-steps.md docs/pr-plan.md
git commit -m "docs: document mysql persistence foundation"
```

---

### Task 7: Final verification and review

**Files:**
- No new files unless fixing review findings.

- [ ] **Step 1: Run targeted tests**

```bash
npm test -- src/lib/db/mysql.test.ts src/lib/db/schema.test.ts src/lib/server/projects.test.ts src/app/api/projects/route.test.ts src/app/api/projects/[projectId]/versions/route.test.ts
```

Expected: all pass.

- [ ] **Step 2: Run full verification**

```bash
npm test
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 3: Review checklist**

Confirm:

- No Redis code added.
- No Auth/RBAC code added.
- `/api/convert` response unchanged.
- localStorage draft functions unchanged.
- No real database password committed beyond example placeholders.
- MySQL DSN from the user's docker env is supported by parser but not copied into project env.

- [ ] **Step 4: Commit any final fixes**

Only if review finds issues.
