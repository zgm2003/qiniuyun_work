import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "src/lib/db/schema.sql"), "utf8");

describe("database schema", () => {
  it("creates the project persistence tables without account tables", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS projects");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS script_versions");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS generation_runs");
    expect(schema).not.toContain("CREATE TABLE IF NOT EXISTS users");
    expect(schema).not.toContain("CREATE TABLE IF NOT EXISTS sessions");
    expect(schema).not.toContain("owner_user_id");
    expect(schema).not.toContain("fk_projects_owner");
    expect(schema).not.toContain("idx_projects_owner_updated");
  });

  it("stores YAML as a whole version instead of splitting screenplay internals", () => {
    expect(schema).toContain("yaml MEDIUMTEXT NOT NULL");
    expect(schema).not.toContain("CREATE TABLE IF NOT EXISTS scenes");
    expect(schema).not.toContain("CREATE TABLE IF NOT EXISTS dialogue");
  });

  it("uses cascading foreign keys for project-owned rows", () => {
    expect(schema).toContain("FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE");
  });

  it("defines prompt templates as versioned fixed-format records", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS prompt_templates");
    expect(schema).toContain("template_key VARCHAR(100) NOT NULL");
    expect(schema).toContain("version VARCHAR(32) NOT NULL");
    expect(schema).toContain("format ENUM('yaml', 'json') NOT NULL");
    expect(schema).toContain("system_prompt TEXT NOT NULL");
    expect(schema).toContain("user_prompt_template MEDIUMTEXT NOT NULL");
    expect(schema).toContain("enabled TINYINT(1) NOT NULL DEFAULT 1");
    expect(schema).toContain("UNIQUE KEY uk_prompt_templates_key_version (template_key, version)");
    expect(schema).toContain("KEY idx_prompt_templates_lookup (template_key, enabled, updated_at)");
  });

  it("defines AI provider settings with encrypted API key fields", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS ai_providers");
    expect(schema).toContain("driver ENUM('openai-compatible') NOT NULL");
    expect(schema).toContain("base_url VARCHAR(512) NOT NULL");
    expect(schema).toContain("api_key_ciphertext TEXT NOT NULL");
    expect(schema).toContain("api_key_iv CHAR(24) NOT NULL");
    expect(schema).toContain("api_key_auth_tag CHAR(24) NOT NULL");
    expect(schema).toContain("api_key_version INT NOT NULL DEFAULT 1");
    expect(schema).toContain("KEY idx_ai_providers_runtime (status, is_default, updated_at)");
  });

  it("defines AI provider models with provider ownership and runtime lookup index", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS ai_provider_models");
    expect(schema).toContain("provider_id VARCHAR(36) NOT NULL");
    expect(schema).toContain("model_id VARCHAR(255) NOT NULL");
    expect(schema).toContain("enabled TINYINT(1) NOT NULL DEFAULT 1");
    expect(schema).toContain("is_default TINYINT(1) NOT NULL DEFAULT 0");
    expect(schema).toContain("UNIQUE KEY uk_ai_provider_models_provider_model (provider_id, model_id)");
    expect(schema).toContain("KEY idx_ai_provider_models_runtime (provider_id, enabled, is_default, updated_at)");
    expect(schema).toContain(
      "CONSTRAINT fk_ai_provider_models_provider FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE CASCADE"
    );
  });
});
