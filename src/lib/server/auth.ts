import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, hashSessionToken, sessionExpiresAt } from "@/lib/auth/session";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { getMysqlPool } from "@/lib/db/mysql";

export type UserSummary = {
  id: string;
  email: string;
  name: string;
};

export type CreateUserInput = {
  email: string;
  password: string;
  name?: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

type UserRow = RowDataPacket & {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  status: "active" | "disabled";
};

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

export async function createUser(
  input: CreateUserInput,
  runner?: MysqlQueryRunner
): Promise<{ user: UserSummary; sessionToken: string }> {
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

  return {
    user: { id, email, name },
    sessionToken: await createSession(id, db)
  };
}

export async function loginUser(
  input: LoginInput,
  runner?: MysqlQueryRunner
): Promise<{ user: UserSummary; sessionToken: string }> {
  const db = resolveRunner(runner);
  const email = normalizeEmail(input.email);
  const [rows] = await db.query<UserRow[]>(
    `SELECT id, email, password_hash, name, status
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  const user = rows[0];
  if (!user) {
    throw new Error("邮箱或密码错误");
  }
  if (user.status !== "active") {
    throw new Error("账号不可用");
  }
  if (!(await verifyPassword(input.password, user.password_hash))) {
    throw new Error("邮箱或密码错误");
  }

  return {
    user: { id: user.id, email: user.email, name: user.name },
    sessionToken: await createSession(user.id, db)
  };
}

export async function getUserBySessionToken(token: string | undefined, runner?: MysqlQueryRunner): Promise<UserSummary | null> {
  if (!token) {
    return null;
  }

  const [rows] = await resolveRunner(runner).query<SessionUserRow[]>(
    `SELECT users.id, users.email, users.name
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?
       AND sessions.expires_at > ?
       AND users.status = 'active'
     LIMIT 1`,
    [hashSessionToken(token), new Date()]
  );

  return rows[0] ? { id: rows[0].id, email: rows[0].email, name: rows[0].name } : null;
}

export async function logoutSession(token: string | undefined, runner?: MysqlQueryRunner): Promise<void> {
  if (!token) {
    return;
  }

  await resolveRunner(runner).query<ResultSetHeader>(`DELETE FROM sessions WHERE token_hash = ?`, [hashSessionToken(token)]);
}
