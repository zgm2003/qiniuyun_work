import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool, type MysqlQueryRunner } from "@/lib/db/mysql";
import { DEFAULT_OPENAI_BASE_URL, listOpenAICompatibleModels, normalizeOpenAIBaseUrl, type FetchImplementation } from "@/lib/openai-compatible";
import { decryptSecret, encryptSecret, type EncryptedSecret, type SecretEnvironment } from "./secret-encryption";

export type AIProviderDriver = "openai-compatible";
export type AIProviderStatus = "enabled" | "disabled";
export type AIProviderHealthStatus = "unknown" | "healthy" | "unhealthy";
export type AIProviderEnvironment = SecretEnvironment;

export type SaveAIProviderSettingsInput = {
  id?: string;
  name: string;
  driver?: AIProviderDriver;
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
  status?: AIProviderStatus;
  isDefault?: boolean;
};

export type AIProviderSettingsView = {
  id: string;
  name: string;
  driver: AIProviderDriver;
  baseUrl: string;
  status: AIProviderStatus;
  isDefault: boolean;
  healthStatus: AIProviderHealthStatus;
  healthMessage: string | null;
  lastHealthCheckedAt: string | null;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DefaultAIProviderSettingsView = AIProviderSettingsView & {
  defaultModel: string;
};

export type RuntimeAIProviderConfig = {
  provider: "openai-compatible";
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type AIProviderHealthResult = {
  healthStatus: Exclude<AIProviderHealthStatus, "unknown">;
  healthMessage: string | null;
};

type AIProviderRow = RowDataPacket & {
  id: string;
  name: string;
  driver: AIProviderDriver;
  base_url: string;
  api_key_ciphertext: string;
  api_key_iv: string;
  api_key_auth_tag: string;
  api_key_version: number;
  status: AIProviderStatus;
  is_default: 0 | 1 | boolean;
  health_status: AIProviderHealthStatus;
  health_message: string | null;
  last_health_checked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type RuntimeAIProviderRow = RowDataPacket & {
  driver: AIProviderDriver;
  base_url: string;
  api_key_ciphertext: string;
  api_key_iv: string;
  api_key_auth_tag: string;
  api_key_version: number;
  model_id: string;
};

type ModelFlagRow = RowDataPacket & {
  model_id: string;
  is_default: 0 | 1 | boolean;
};

const DEFAULT_MODEL = "gpt-5.5";
const HEALTH_MESSAGE_LIMIT = 500;

function resolveRunner(runner?: MysqlQueryRunner): MysqlQueryRunner {
  return runner ?? getMysqlPool();
}

function requireTrimmed(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(message);
  }

  return trimmed;
}

function boolToTinyInt(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

function rowFlag(value: 0 | 1 | boolean): boolean {
  return value === true || value === 1;
}

function mapProviderRow(row: AIProviderRow): AIProviderSettingsView {
  return {
    id: row.id,
    name: row.name,
    driver: row.driver,
    baseUrl: row.base_url,
    status: row.status,
    isDefault: rowFlag(row.is_default),
    healthStatus: row.health_status,
    healthMessage: row.health_message,
    lastHealthCheckedAt: row.last_health_checked_at ? row.last_health_checked_at.toISOString() : null,
    hasApiKey: Boolean(row.api_key_ciphertext),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function secretFromRow(row: {
  api_key_ciphertext: string;
  api_key_iv: string;
  api_key_auth_tag: string;
  api_key_version: number;
}): EncryptedSecret {
  return {
    ciphertext: row.api_key_ciphertext,
    iv: row.api_key_iv,
    authTag: row.api_key_auth_tag,
    version: row.api_key_version
  };
}

function resolveEnvRuntimeConfig(env: AIProviderEnvironment = process.env): RuntimeAIProviderConfig {
  const apiKey = env.OPENAI_COMPATIBLE_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("OPENAI_COMPATIBLE_API_KEY 未配置");
  }

  return {
    provider: "openai-compatible",
    apiKey,
    baseUrl: normalizeOpenAIBaseUrl(env.OPENAI_COMPATIBLE_BASE_URL ?? DEFAULT_OPENAI_BASE_URL),
    model: env.OPENAI_COMPATIBLE_MODEL ?? DEFAULT_MODEL
  };
}

async function getProviderSecret(providerId: string, runner: MysqlQueryRunner): Promise<AIProviderRow> {
  const [rows] = await runner.query<AIProviderRow[]>(
    `SELECT id, name, driver, base_url, api_key_ciphertext, api_key_iv, api_key_auth_tag, api_key_version,
            status, is_default, health_status, health_message, last_health_checked_at, created_at, updated_at
     FROM ai_providers
     WHERE id = ?
     LIMIT 1`,
    [requireTrimmed(providerId, "providerId 不能为空")]
  );
  if (!rows[0]) {
    throw new Error("AI provider 不存在");
  }

  return rows[0];
}

async function saveDefaultProviderModel(providerId: string, model: string, runner: MysqlQueryRunner): Promise<void> {
  const modelId = requireTrimmed(model, "默认模型不能为空");
  const now = new Date();

  await runner.query<ResultSetHeader>(
    `UPDATE ai_provider_models
     SET is_default = 0, updated_at = ?
     WHERE provider_id = ?`,
    [now, providerId]
  );
  await runner.query<ResultSetHeader>(
    `INSERT INTO ai_provider_models (
       id, provider_id, model_id, display_name, enabled, is_default, last_seen_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       enabled = VALUES(enabled),
       is_default = VALUES(is_default),
       updated_at = VALUES(updated_at)`,
    [randomUUID(), providerId, modelId, modelId, 1, 1, now, now, now]
  );
}

export async function saveAIProviderSettings(
  input: SaveAIProviderSettingsInput,
  runner?: MysqlQueryRunner,
  env?: AIProviderEnvironment
): Promise<AIProviderSettingsView> {
  const db = resolveRunner(runner);
  const id = input.id ?? randomUUID();
  const name = requireTrimmed(input.name, "供应商名称不能为空");
  const driver = input.driver ?? "openai-compatible";
  if (driver !== "openai-compatible") {
    throw new Error(`不支持的 AI provider driver：${driver}`);
  }
  const baseUrl = normalizeOpenAIBaseUrl(requireTrimmed(input.baseUrl, "Base URL 不能为空"));
  const encrypted = encryptSecret(input.apiKey, env);
  const status = input.status ?? "enabled";
  const isDefault = input.isDefault ?? false;
  const now = new Date();

  if (isDefault) {
    await db.query<ResultSetHeader>(`UPDATE ai_providers SET is_default = 0 WHERE is_default = 1`);
  }

  if (input.id) {
    await db.query<ResultSetHeader>(
      `UPDATE ai_providers
       SET name = ?, driver = ?, base_url = ?, api_key_ciphertext = ?, api_key_iv = ?, api_key_auth_tag = ?,
           api_key_version = ?, status = ?, is_default = ?, updated_at = ?
       WHERE id = ?`,
      [
        name,
        driver,
        baseUrl,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
        encrypted.version,
        status,
        boolToTinyInt(isDefault),
        now,
        id
      ]
    );
  } else {
    await db.query<ResultSetHeader>(
      `INSERT INTO ai_providers (
         id, name, driver, base_url, api_key_ciphertext, api_key_iv, api_key_auth_tag, api_key_version,
         status, is_default, health_status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        driver,
        baseUrl,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
        encrypted.version,
        status,
        boolToTinyInt(isDefault),
        "unknown",
        now,
        now
      ]
    );
  }

  if (input.defaultModel !== undefined) {
    await saveDefaultProviderModel(id, input.defaultModel, db);
  }

  const provider = await getAIProviderSettings(id, db);
  if (!provider) {
    throw new Error("AI provider 保存失败");
  }

  return provider;
}

export async function listAIProviderSettings(runner?: MysqlQueryRunner): Promise<AIProviderSettingsView[]> {
  const [rows] = await resolveRunner(runner).query<AIProviderRow[]>(
    `SELECT id, name, driver, base_url, api_key_ciphertext, api_key_iv, api_key_auth_tag, api_key_version,
            status, is_default, health_status, health_message, last_health_checked_at, created_at, updated_at
     FROM ai_providers
     ORDER BY is_default DESC, updated_at DESC`
  );

  return rows.map(mapProviderRow);
}

export async function getAIProviderSettings(
  providerId: string,
  runner?: MysqlQueryRunner
): Promise<AIProviderSettingsView | null> {
  const [rows] = await resolveRunner(runner).query<AIProviderRow[]>(
    `SELECT id, name, driver, base_url, api_key_ciphertext, api_key_iv, api_key_auth_tag, api_key_version,
            status, is_default, health_status, health_message, last_health_checked_at, created_at, updated_at
     FROM ai_providers
     WHERE id = ?
     LIMIT 1`,
    [requireTrimmed(providerId, "providerId 不能为空")]
  );

  return rows[0] ? mapProviderRow(rows[0]) : null;
}


export async function getDefaultAIProviderSettings(
  runner?: MysqlQueryRunner
): Promise<DefaultAIProviderSettingsView | null> {
  const [rows] = await resolveRunner(runner).query<Array<AIProviderRow & { default_model: string }>>(
    `SELECT providers.id, providers.name, providers.driver, providers.base_url,
            providers.api_key_ciphertext, providers.api_key_iv, providers.api_key_auth_tag, providers.api_key_version,
            providers.status, providers.is_default, providers.health_status, providers.health_message,
            providers.last_health_checked_at, providers.created_at, providers.updated_at,
            models.model_id AS default_model
     FROM ai_providers providers
     INNER JOIN ai_provider_models models ON models.provider_id = providers.id
     WHERE providers.status = 'enabled'
       AND providers.is_default = 1
       AND models.enabled = 1
       AND models.is_default = 1
     ORDER BY providers.updated_at DESC, models.updated_at DESC
     LIMIT 1`
  );
  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ...mapProviderRow(row),
    defaultModel: row.default_model
  };
}

export async function resolveRuntimeAIProviderConfig(
  runner?: MysqlQueryRunner,
  env?: AIProviderEnvironment
): Promise<RuntimeAIProviderConfig> {
  try {
    const [rows] = await resolveRunner(runner).query<RuntimeAIProviderRow[]>(
      `SELECT providers.driver, providers.base_url, providers.api_key_ciphertext, providers.api_key_iv,
              providers.api_key_auth_tag, providers.api_key_version, models.model_id
       FROM ai_providers providers
       INNER JOIN ai_provider_models models ON models.provider_id = providers.id
       WHERE providers.status = 'enabled'
         AND providers.is_default = 1
         AND models.enabled = 1
         AND models.is_default = 1
       ORDER BY providers.updated_at DESC, models.updated_at DESC
       LIMIT 1`
    );
    const row = rows[0];
    if (row) {
      return {
        provider: row.driver,
        apiKey: decryptSecret(secretFromRow(row), env),
        baseUrl: normalizeOpenAIBaseUrl(row.base_url),
        model: row.model_id
      };
    }
  } catch {
    return resolveEnvRuntimeConfig(env);
  }

  return resolveEnvRuntimeConfig(env);
}

export async function refreshAIProviderModels(
  providerId: string,
  fetchImpl: FetchImplementation = fetch,
  runner?: MysqlQueryRunner,
  env?: AIProviderEnvironment
): Promise<string[]> {
  const db = resolveRunner(runner);
  const provider = await getProviderSecret(providerId, db);
  const apiKey = decryptSecret(secretFromRow(provider), env);
  const modelIds = await listOpenAICompatibleModels({ apiKey, baseUrl: provider.base_url }, fetchImpl);
  const [existingRows] = await db.query<ModelFlagRow[]>(
    `SELECT model_id, is_default
     FROM ai_provider_models
     WHERE provider_id = ?`,
    [provider.id]
  );
  let hasDefault = existingRows.some((row) => rowFlag(row.is_default));
  const now = new Date();

  for (const [index, modelId] of modelIds.entries()) {
    const isDefault = !hasDefault && index === 0;
    if (isDefault) {
      hasDefault = true;
    }
    await db.query<ResultSetHeader>(
      `INSERT INTO ai_provider_models (
         id, provider_id, model_id, display_name, enabled, is_default, last_seen_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         display_name = VALUES(display_name),
         last_seen_at = VALUES(last_seen_at),
         updated_at = VALUES(updated_at)`,
      [randomUUID(), provider.id, modelId, modelId, 1, boolToTinyInt(isDefault), now, now, now]
    );
  }

  return modelIds;
}

function healthMessageFromError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "AI provider 健康检查失败";
  const firstSentence = raw.split("。")[0];
  return firstSentence.slice(0, HEALTH_MESSAGE_LIMIT);
}

export async function checkAIProviderHealth(
  providerId: string,
  fetchImpl: FetchImplementation = fetch,
  runner?: MysqlQueryRunner,
  env?: AIProviderEnvironment
): Promise<AIProviderHealthResult> {
  const db = resolveRunner(runner);
  const checkedAt = new Date();

  try {
    await refreshAIProviderModels(providerId, fetchImpl, db, env);
    await db.query<ResultSetHeader>(
      `UPDATE ai_providers
       SET health_status = ?, health_message = ?, last_health_checked_at = ?
       WHERE id = ?`,
      ["healthy", null, checkedAt, requireTrimmed(providerId, "providerId 不能为空")]
    );
    return { healthStatus: "healthy", healthMessage: null };
  } catch (error) {
    const message = healthMessageFromError(error);
    await db.query<ResultSetHeader>(
      `UPDATE ai_providers
       SET health_status = ?, health_message = ?, last_health_checked_at = ?
       WHERE id = ?`,
      ["unhealthy", message, checkedAt, requireTrimmed(providerId, "providerId 不能为空")]
    );
    return { healthStatus: "unhealthy", healthMessage: message };
  }
}
