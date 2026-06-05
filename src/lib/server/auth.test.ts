import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { describe, expect, it } from "vitest";
import { hashSessionToken } from "@/lib/auth/session";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { createUser, getUserBySessionToken, loginUser, logoutSession } from "./auth";

class FakeAuthDb implements MysqlQueryRunner {
  users: Array<{
    id: string;
    email: string;
    password_hash: string;
    name: string;
    status: "active" | "disabled";
    created_at: Date;
    updated_at: Date;
  }> = [];
  sessions: Array<{ id: string; user_id: string; token_hash: string; expires_at: Date; created_at: Date }> = [];

  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(
    sql: string,
    values: unknown[] = []
  ): Promise<[T, ...unknown[]]> {
    if (sql.includes("INSERT INTO users")) {
      const [id, email, passwordHash, name, status, createdAt, updatedAt] = values as [
        string,
        string,
        string,
        string,
        "active",
        Date,
        Date
      ];
      if (this.users.some((user) => user.email === email)) {
        throw new Error("Duplicate entry");
      }
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

    if (sql.includes("DELETE FROM sessions") && sql.includes("token_hash = ?")) {
      const [tokenHash] = values as [string];
      this.sessions = this.sessions.filter((session) => session.token_hash !== tokenHash);
      return [{ affectedRows: 1 } as ResultSetHeader as T];
    }

    if (sql.includes("FROM sessions") && sql.includes("token_hash = ?")) {
      const [tokenHash, now] = values as [string, Date];
      const session = this.sessions.find((item) => item.token_hash === tokenHash && item.expires_at > now);
      const user = session ? this.users.find((item) => item.id === session.user_id && item.status === "active") : undefined;
      return [(user ? [{ id: user.id, email: user.email, name: user.name }] : []) as RowDataPacket[] as T];
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

    await expect(loginUser({ email: "AUTHOR@example.com", password: "long-password" }, db)).resolves.toMatchObject({
      user: { email: "author@example.com" }
    });
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
