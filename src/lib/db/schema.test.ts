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

  it("defines users and sessions for login ownership", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(schema).toContain("UNIQUE KEY uk_users_email (email)");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS sessions");
    expect(schema).toContain("token_hash CHAR(64) NOT NULL");
    expect(schema).toContain("CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE");
  });

  it("keeps project owner nullable for existing anonymous projects", () => {
    expect(schema).toContain("owner_user_id VARCHAR(36) NULL");
    expect(schema).toContain("KEY idx_projects_owner_updated (owner_user_id, updated_at)");
    expect(schema).toContain("CONSTRAINT fk_projects_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL");
  });
});
