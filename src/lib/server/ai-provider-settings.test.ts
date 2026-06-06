import { randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import type { MysqlQueryRunner } from "@/lib/db/mysql";
import { decryptSecret } from "./secret-encryption";
import {
  checkAIProviderHealth,
  listAIProviderSettings,
  resolveRuntimeAIProviderConfig,
  saveAIProviderSettings
} from "./ai-provider-settings";

type QueryCall = {
  sql: string;
  values: unknown[] | undefined;
};

type AISettingsRow = RowDataPacket & {
  id: string;
  base_url: string;
  model: string;
  api_key_ciphertext: string;
  api_key_iv: string;
  api_key_auth_tag: string;
  api_key_version: number;
  health_status: "unknown" | "healthy" | "unhealthy";
  health_message: string | null;
  last_health_checked_at: Date | null;
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

class FakeAISettingsDb implements MysqlQueryRunner {
  calls: QueryCall[] = [];
  settings: AISettingsRow | null = null;
  failRuntimeLookup = false;

  async query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(
    sql: string,
    values?: unknown[]
  ): Promise<[T, ...unknown[]]> {
    this.calls.push({ sql, values });

    if (sql.includes("INSERT INTO ai_settings")) {
      const [
        id,
        baseUrl,
        model,
        ciphertext,
        iv,
        authTag,
        version,
        healthStatus,
        createdAt,
        updatedAt
      ] = values as [string, string, string, string, string, string, number, "unknown", Date, Date];
      const nextRow = {
        id,
        base_url: baseUrl,
        model,
        api_key_ciphertext: ciphertext,
        api_key_iv: iv,
        api_key_auth_tag: authTag,
        api_key_version: version,
        health_status: healthStatus,
        health_message: null,
        last_health_checked_at: null,
        created_at: this.settings?.created_at ?? createdAt,
        updated_at: updatedAt
      } as AISettingsRow;
      this.settings = nextRow;
      return [{ affectedRows: 1 } as ResultSetHeader as T];
    }

    if (sql.includes("FROM ai_settings") && sql.includes("LIMIT 1")) {
      if (this.failRuntimeLookup) {
        throw new Error("db down");
      }
      return [(this.settings ? [this.settings] : []) as RowDataPacket[] as T];
    }

    if (sql.includes("FROM ai_settings")) {
      return [(this.settings ? [this.settings] : []) as RowDataPacket[] as T];
    }

    if (sql.includes("UPDATE ai_settings") && sql.includes("health_status")) {
      const [healthStatus, healthMessage, checkedAt, id] = values as [
        "healthy" | "unhealthy",
        string | null,
        Date,
        string
      ];
      if (this.settings?.id === id) {
        this.settings.health_status = healthStatus;
        this.settings.health_message = healthMessage;
        this.settings.last_health_checked_at = checkedAt;
      }
      return [{ affectedRows: this.settings?.id === id ? 1 : 0 } as ResultSetHeader as T];
    }

    throw new Error(`Unhandled SQL: ${sql}`);
  }
}

describe("AI settings service", () => {
  it("saves the one runtime AI setting with encrypted API key fields", async () => {
    const env = envWithMasterKey();
    const db = new FakeAISettingsDb();

    const saved = await saveAIProviderSettings(
      {
        baseUrl: "https://llm.example.test",
        apiKey: "sk-live-secret",
        model: "gpt-5.4"
      },
      db,
      env
    );

    expect(saved).toMatchObject({
      id: "default",
      name: "OpenAI Compatible",
      driver: "openai-compatible",
      baseUrl: "https://llm.example.test/v1",
      defaultModel: "gpt-5.4",
      isDefault: true,
      hasApiKey: true
    });
    expect(JSON.stringify(db.calls)).not.toContain("sk-live-secret");
    expect(db.settings).not.toBeNull();
    expect(db.settings?.api_key_ciphertext).not.toBe("sk-live-secret");
    expect(
      decryptSecret(
        {
          ciphertext: db.settings!.api_key_ciphertext,
          iv: db.settings!.api_key_iv,
          authTag: db.settings!.api_key_auth_tag,
          version: db.settings!.api_key_version
        },
        env
      )
    ).toBe("sk-live-secret");
  });

  it("updates the singleton row instead of creating provider or model rows", async () => {
    const env = envWithMasterKey();
    const db = new FakeAISettingsDb();

    await saveAIProviderSettings({ baseUrl: "https://one.example.test", apiKey: "key-1", model: "model-1" }, db, env);
    await saveAIProviderSettings({ baseUrl: "https://two.example.test", apiKey: "key-2", model: "model-2" }, db, env);

    expect(db.settings).toMatchObject({ id: "default", base_url: "https://two.example.test/v1", model: "model-2" });
    const serializedCalls = JSON.stringify(db.calls);
    expect(serializedCalls).not.toContain("ai_providers");
    expect(serializedCalls).not.toContain("ai_provider_models");
  });

  it("lists safe views without returning secret material", async () => {
    const env = envWithMasterKey();
    const db = new FakeAISettingsDb();
    await saveAIProviderSettings({ baseUrl: "https://llm.example.test", apiKey: "sk-live-secret", model: "gpt-5.4" }, db, env);

    const list = await listAIProviderSettings(db);
    const serialized = JSON.stringify(list);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "default", hasApiKey: true, healthStatus: "unknown", defaultModel: "gpt-5.4" });
    expect(serialized).not.toContain("api_key_ciphertext");
    expect(serialized).not.toContain("api_key_iv");
    expect(serialized).not.toContain("api_key_auth_tag");
    expect(serialized).not.toContain("sk-live-secret");
  });

  it("resolves the database AI setting and falls back to env when DB is unusable", async () => {
    const env = envWithMasterKey();
    const db = new FakeAISettingsDb();
    await saveAIProviderSettings({ baseUrl: "https://db.example.test", apiKey: "db-key", model: "db-model" }, db, env);

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

  it("checks health from the singleton setting without persisting model lists", async () => {
    const env = envWithMasterKey();
    const db = new FakeAISettingsDb();
    await saveAIProviderSettings({ baseUrl: "https://db.example.test", apiKey: "db-key", model: "db-model" }, db, env);
    const okFetch = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "gpt-ok" }] }), { status: 200 }));

    await expect(checkAIProviderHealth("default", okFetch, db, env)).resolves.toEqual({
      healthStatus: "healthy",
      healthMessage: null
    });
    expect(db.settings).toMatchObject({ health_status: "healthy", health_message: null });
    expect(JSON.stringify(db.calls)).not.toContain("ai_provider_models");

    const badFetch = vi.fn(async () => new Response("bad body with secret-looking text", { status: 500 }));
    const result = await checkAIProviderHealth("default", badFetch, db, env);

    expect(result.healthStatus).toBe("unhealthy");
    expect(result.healthMessage).toContain("模型列表接口请求失败：500");
    expect(result.healthMessage).not.toContain("bad body");
    expect(db.settings?.health_status).toBe("unhealthy");
  });
});
