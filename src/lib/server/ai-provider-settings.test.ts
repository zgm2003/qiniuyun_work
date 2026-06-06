import { randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { decryptSecret } from "./secret-encryption";
import {
  checkAIProviderHealth,
  listAIProviderSettings,
  refreshAIProviderModels,
  resolveRuntimeAIProviderConfig,
  saveAIProviderSettings
} from "./ai-provider-settings";

type QueryCall = {
  sql: string;
  values: unknown[] | undefined;
};

type ProviderRow = RowDataPacket & {
  id: string;
  name: string;
  driver: "openai-compatible";
  base_url: string;
  api_key_ciphertext: string;
  api_key_iv: string;
  api_key_auth_tag: string;
  api_key_version: number;
  status: "enabled" | "disabled";
  is_default: 0 | 1;
  health_status: "unknown" | "healthy" | "unhealthy";
  health_message: string | null;
  last_health_checked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type ModelRow = RowDataPacket & {
  id: string;
  provider_id: string;
  model_id: string;
  display_name: string;
  enabled: 0 | 1;
  is_default: 0 | 1;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function envWithMasterKey(): Record<string, string> {
  return {
    AI_CONFIG_MASTER_KEY: randomBytes(32).toString("base64"),
    OPENAI_COMPATIBLE_API_KEY: "env-key",
    OPENAI_COMPATIBLE_BASE_URL: "https://env.example.test",
    OPENAI_COMPATIBLE_MODEL: "env-model"
  };
}

class FakeProviderDb implements MysqlQueryRunner {
  calls: QueryCall[] = [];
  providers: ProviderRow[] = [];
  models: ModelRow[] = [];
  failRuntimeLookup = false;

  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(
    sql: string,
    values?: unknown[]
  ): Promise<[T, ...unknown[]]> {
    this.calls.push({ sql, values });

    if (sql.includes("UPDATE ai_providers") && sql.includes("SET is_default = 0")) {
      for (const provider of this.providers) {
        provider.is_default = 0;
      }
      return [{ affectedRows: this.providers.length } as ResultSetHeader as T];
    }

    if (sql.includes("INSERT INTO ai_providers")) {
      const [
        id,
        name,
        driver,
        baseUrl,
        ciphertext,
        iv,
        authTag,
        version,
        status,
        isDefault,
        healthStatus,
        createdAt,
        updatedAt
      ] = values as [string, string, "openai-compatible", string, string, string, string, number, "enabled" | "disabled", 0 | 1, "unknown", Date, Date];
      this.providers.push({
        id,
        name,
        driver,
        base_url: baseUrl,
        api_key_ciphertext: ciphertext,
        api_key_iv: iv,
        api_key_auth_tag: authTag,
        api_key_version: version,
        status,
        is_default: isDefault,
        health_status: healthStatus,
        health_message: null,
        last_health_checked_at: null,
        created_at: createdAt,
        updated_at: updatedAt
      } as ProviderRow);
      return [{ affectedRows: 1 } as ResultSetHeader as T];
    }

    if (sql.includes("SELECT id, name, driver, base_url") && sql.includes("FROM ai_providers") && sql.includes("WHERE id = ?")) {
      const [id] = values as [string];
      return [this.providers.filter((provider) => provider.id === id) as RowDataPacket[] as T];
    }

    if (sql.includes("SELECT id, name, driver, base_url") && sql.includes("FROM ai_providers")) {
      return [this.providers as RowDataPacket[] as T];
    }

    if (sql.includes("INNER JOIN ai_provider_models")) {
      if (this.failRuntimeLookup) {
        throw new Error("db down");
      }
      const provider = this.providers.find((row) => row.status === "enabled" && row.is_default === 1);
      const model = provider
        ? this.models.find((row) => row.provider_id === provider.id && row.enabled === 1 && row.is_default === 1)
        : undefined;
      return [(provider && model ? [{ ...provider, model_id: model.model_id }] : []) as RowDataPacket[] as T];
    }

    if (sql.includes("SELECT id, driver, base_url") && sql.includes("FROM ai_providers") && sql.includes("WHERE id = ?")) {
      const [id] = values as [string];
      return [this.providers.filter((provider) => provider.id === id) as RowDataPacket[] as T];
    }

    if (sql.includes("SELECT model_id, is_default") && sql.includes("FROM ai_provider_models")) {
      const [providerId] = values as [string];
      return [this.models.filter((model) => model.provider_id === providerId) as RowDataPacket[] as T];
    }

    if (sql.includes("INSERT INTO ai_provider_models")) {
      const [id, providerId, modelId, displayName, enabled, isDefault, lastSeenAt, createdAt, updatedAt] = values as [
        string,
        string,
        string,
        string,
        0 | 1,
        0 | 1,
        Date,
        Date,
        Date
      ];
      const existing = this.models.find((model) => model.provider_id === providerId && model.model_id === modelId);
      if (existing) {
        existing.display_name = displayName;
        existing.last_seen_at = lastSeenAt;
        existing.updated_at = updatedAt;
      } else {
        this.models.push({
          id,
          provider_id: providerId,
          model_id: modelId,
          display_name: displayName,
          enabled,
          is_default: isDefault,
          last_seen_at: lastSeenAt,
          created_at: createdAt,
          updated_at: updatedAt
        } as ModelRow);
      }
      return [{ affectedRows: 1 } as ResultSetHeader as T];
    }

    if (sql.includes("UPDATE ai_providers") && sql.includes("health_status")) {
      const [healthStatus, healthMessage, checkedAt, providerId] = values as [
        "healthy" | "unhealthy",
        string | null,
        Date,
        string
      ];
      const provider = this.providers.find((row) => row.id === providerId);
      if (provider) {
        provider.health_status = healthStatus;
        provider.health_message = healthMessage;
        provider.last_health_checked_at = checkedAt;
      }
      return [{ affectedRows: provider ? 1 : 0 } as ResultSetHeader as T];
    }

    throw new Error(`Unhandled SQL: ${sql}`);
  }
}

describe("AI provider settings service", () => {
  it("saves provider settings with encrypted API key fields only", async () => {
    const env = envWithMasterKey();
    const db = new FakeProviderDb();

    const saved = await saveAIProviderSettings(
      {
        name: "OpenAI 兼容供应商",
        baseUrl: "https://llm.example.test",
        apiKey: "sk-live-secret",
        isDefault: true
      },
      db,
      env
    );

    expect(saved).toMatchObject({
      name: "OpenAI 兼容供应商",
      driver: "openai-compatible",
      baseUrl: "https://llm.example.test/v1",
      isDefault: true,
      hasApiKey: true
    });
    expect(JSON.stringify(db.calls)).not.toContain("sk-live-secret");
    const provider = db.providers[0];
    expect(provider.api_key_ciphertext).not.toBe("sk-live-secret");
    expect(
      decryptSecret(
        {
          ciphertext: provider.api_key_ciphertext,
          iv: provider.api_key_iv,
          authTag: provider.api_key_auth_tag,
          version: provider.api_key_version
        },
        env
      )
    ).toBe("sk-live-secret");
  });

  it("lists safe views without returning secret material", async () => {
    const env = envWithMasterKey();
    const db = new FakeProviderDb();
    await saveAIProviderSettings({ name: "Provider", baseUrl: "https://llm.example.test", apiKey: "sk-live-secret" }, db, env);

    const list = await listAIProviderSettings(db);
    const serialized = JSON.stringify(list);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ hasApiKey: true, healthStatus: "unknown" });
    expect(serialized).not.toContain("api_key_ciphertext");
    expect(serialized).not.toContain("api_key_iv");
    expect(serialized).not.toContain("api_key_auth_tag");
    expect(serialized).not.toContain("sk-live-secret");
  });

  it("resolves default database provider and falls back to env when DB is unusable", async () => {
    const env = envWithMasterKey();
    const db = new FakeProviderDb();
    const saved = await saveAIProviderSettings(
      { name: "Provider", baseUrl: "https://db.example.test", apiKey: "db-key", isDefault: true },
      db,
      env
    );
    db.models.push({
      id: "model-1",
      provider_id: saved.id,
      model_id: "db-model",
      display_name: "db-model",
      enabled: 1,
      is_default: 1,
      last_seen_at: null,
      created_at: new Date(),
      updated_at: new Date()
    } as ModelRow);

    await expect(resolveRuntimeAIProviderConfig(db, env)).resolves.toEqual({
      provider: "openai-compatible",
      apiKey: "db-key",
      baseUrl: "https://db.example.test/v1",
      model: "db-model"
    });

    db.failRuntimeLookup = true;
    await expect(resolveRuntimeAIProviderConfig(db, env)).resolves.toEqual({
      provider: "openai-compatible",
      apiKey: "env-key",
      baseUrl: "https://env.example.test/v1",
      model: "env-model"
    });
  });

  it("refreshes models without overwriting existing enabled/default flags", async () => {
    const env = envWithMasterKey();
    const db = new FakeProviderDb();
    const saved = await saveAIProviderSettings(
      { name: "Provider", baseUrl: "https://db.example.test", apiKey: "db-key", isDefault: true },
      db,
      env
    );
    db.models.push({
      id: "existing",
      provider_id: saved.id,
      model_id: "gpt-existing",
      display_name: "Old name",
      enabled: 0,
      is_default: 1,
      last_seen_at: null,
      created_at: new Date(),
      updated_at: new Date()
    } as ModelRow);
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: "gpt-existing" }, { id: "gpt-new" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const models = await refreshAIProviderModels(saved.id, fetchImpl, db, env);

    expect(models).toEqual(["gpt-existing", "gpt-new"]);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://db.example.test/v1/models");
    expect(db.models.find((model) => model.model_id === "gpt-existing")).toMatchObject({
      enabled: 0,
      is_default: 1,
      display_name: "gpt-existing"
    });
    expect(db.models.find((model) => model.model_id === "gpt-new")).toMatchObject({
      enabled: 1,
      is_default: 0
    });
  });

  it("writes health status without storing full provider responses", async () => {
    const env = envWithMasterKey();
    const db = new FakeProviderDb();
    const saved = await saveAIProviderSettings(
      { name: "Provider", baseUrl: "https://db.example.test", apiKey: "db-key", isDefault: true },
      db,
      env
    );
    const okFetch = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "gpt-ok" }] }), { status: 200 }));

    await expect(checkAIProviderHealth(saved.id, okFetch, db, env)).resolves.toEqual({
      healthStatus: "healthy",
      healthMessage: null
    });
    expect(db.providers[0]).toMatchObject({ health_status: "healthy", health_message: null });

    const badFetch = vi.fn(async () => new Response("bad body with secret-looking text", { status: 500 }));
    const result = await checkAIProviderHealth(saved.id, badFetch, db, env);

    expect(result.healthStatus).toBe("unhealthy");
    expect(result.healthMessage).toContain("模型列表接口请求失败：500");
    expect(result.healthMessage).not.toContain("bad body");
    expect(db.providers[0].health_status).toBe("unhealthy");
  });
});
