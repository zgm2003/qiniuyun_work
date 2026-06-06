import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "src/lib/db/migrations/2026-06-06-ai-settings.sql"), "utf8");

describe("AI settings migration", () => {
  it("creates the singleton ai_settings table", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ai_settings");
    expect(migration).toContain("id VARCHAR(32) NOT NULL PRIMARY KEY");
    expect(migration).toContain("model VARCHAR(255) NOT NULL");
    expect(migration).toContain("api_key_ciphertext TEXT NOT NULL");
    expect(migration).toContain("KEY idx_ai_settings_updated_at (updated_at)");
  });

  it("copies the old default provider/model only when old tables exist", () => {
    expect(migration).toContain("information_schema.tables");
    expect(migration).toContain("ai_providers");
    expect(migration).toContain("ai_provider_models");
    expect(migration).toContain("PREPARE migrate_ai_settings_stmt");
    expect(migration).toContain("EXECUTE migrate_ai_settings_stmt");
  });

  it("does not drop old provider tables", () => {
    expect(migration).not.toContain("DROP TABLE");
  });
});


describe("database migration scripts", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };

  it("exposes a command for the ai_settings migration", () => {
    expect(packageJson.scripts["db:migrate:ai-settings"]).toBe(
      "node scripts/apply-db-sql.mjs src/lib/db/migrations/2026-06-06-ai-settings.sql"
    );
  });

  it("exposes a command for full schema initialization", () => {
    expect(packageJson.scripts["db:schema"]).toBe("node scripts/apply-db-sql.mjs src/lib/db/schema.sql");
  });
});
