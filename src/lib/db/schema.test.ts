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
