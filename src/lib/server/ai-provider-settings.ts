import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool, type MysqlQueryRunner } from "@/lib/db/mysql";
import { DEFAULT_OPENAI_BASE_URL, listOpenAICompatibleModels, normalizeOpenAIBaseUrl, type FetchImplementation } from "@/lib/openai-compatible";
import { decryptSecret, encryptSecret, type EncryptedSecret, type SecretEnvironment } from "./secret-encryption";

export type AIProviderDriver = "openai-compatible";
export type AIProviderStatus = "enabled" | "disabled";
export type AIProviderHealthStatus = "unknown" | "healthy" | "unhealthy";
export type AIProviderEnvironment = SecretEnvironment;

export type SaveAIProviderSettingsInput = {
  driver?: AIProviderDriver;
  baseUrl: string;
  apiKey: string;
  model: string;
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
  defaultModel: string;
  createdAt: string;
  updatedAt: string;
};

export type DefaultAIProviderSettingsView = AIProviderSettingsView;

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

type AISettingsRow = RowDataPacket & {
  id: string;
  base_url: string;
  model: string;
  api_key_ciphertext: string;
  api_key_iv: string;
  api_key_auth_tag: string;
  api_key_version: number;
  health_status: AIProviderHealthStatus;
  health_message: string | null;
  last_health_checked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const AI_SETTINGS_ID = "default";
const AI_SETTINGS_NAME = "OpenAI Compatible";
const DEFAULT_MODEL = "gpt-5.5";
const HEALTH_MESSAGE_LIMIT = 500;

function resolveRunner(runner?: MysqlQueryRunner): MysqlQueryRunner {
  return runner ?? getMysqlPool();
}

function requireTrimmed(value: string | undefined, message: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(message);
  }

  return trimmed;
}

function mapSettingsRow(row: AISettingsRow): DefaultAIProviderSettingsView {
  return {
    id: row.id,
    name: AI_SETTINGS_NAME,
    driver: "openai-compatible",
    baseUrl: row.base_url,
    status: "enabled",
    isDefault: true,
    healthStatus: row.health_status,
    healthMessage: row.health_message,
    lastHealthCheckedAt: row.last_health_checked_at ? row.last_health_checked_at.toISOString() : null,
    hasApiKey: Boolean(row.api_key_ciphertext),
    defaultModel: row.model,
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

async function getSettingsSecret(settingId: string, runner: MysqlQueryRunner): Promise<AISettingsRow> {
  const [rows] = await runner.query<AISettingsRow[]>(
    `SELECT id, base_url, model, api_key_ciphertext, api_key_iv, api_key_auth_tag, api_key_version,
            health_status, health_message, last_health_checked_at, created_at, updated_at
     FROM ai_settings
     WHERE id = ?
     LIMIT 1`,
    [requireTrimmed(settingId, "AI 配置 id 不能为空")]
  );
  if (!rows[0]) {
    throw new Error("AI 配置不存在");
  }

  return rows[0];
}

export async function saveAIProviderSettings(
  input: SaveAIProviderSettingsInput,
  runner?: MysqlQueryRunner,
  env?: AIProviderEnvironment
): Promise<DefaultAIProviderSettingsView> {
  if (input.driver && input.driver !== "openai-compatible") {
    throw new Error(`不支持的 AI provider driver：${input.driver}`);
  }

  const db = resolveRunner(runner);
  const baseUrl = normalizeOpenAIBaseUrl(requireTrimmed(input.baseUrl, "Base URL 不能为空"));
  const model = requireTrimmed(input.model, "默认模型不能为空");
  const encrypted = encryptSecret(input.apiKey, env);
  const now = new Date();

  await db.query<ResultSetHeader>(
    `INSERT INTO ai_settings (
       id, base_url, model, api_key_ciphertext, api_key_iv, api_key_auth_tag, api_key_version,
       health_status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       base_url = VALUES(base_url),
       model = VALUES(model),
       api_key_ciphertext = VALUES(api_key_ciphertext),
       api_key_iv = VALUES(api_key_iv),
       api_key_auth_tag = VALUES(api_key_auth_tag),
       api_key_version = VALUES(api_key_version),
       health_status = 'unknown',
       health_message = NULL,
       last_health_checked_at = NULL,
       updated_at = VALUES(updated_at)`,
    [AI_SETTINGS_ID, baseUrl, model, encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.version, "unknown", now, now]
  );

  const settings = await getDefaultAIProviderSettings(db);
  if (!settings) {
    throw new Error("AI 配置保存失败");
  }

  return settings;
}

export async function listAIProviderSettings(runner?: MysqlQueryRunner): Promise<DefaultAIProviderSettingsView[]> {
  const [rows] = await resolveRunner(runner).query<AISettingsRow[]>(
    `SELECT id, base_url, model, api_key_ciphertext, api_key_iv, api_key_auth_tag, api_key_version,
            health_status, health_message, last_health_checked_at, created_at, updated_at
     FROM ai_settings
     ORDER BY updated_at DESC
     LIMIT 1`
  );

  return rows.map(mapSettingsRow);
}

export async function getAIProviderSettings(
  providerId: string,
  runner?: MysqlQueryRunner
): Promise<DefaultAIProviderSettingsView | null> {
  const [rows] = await resolveRunner(runner).query<AISettingsRow[]>(
    `SELECT id, base_url, model, api_key_ciphertext, api_key_iv, api_key_auth_tag, api_key_version,
            health_status, health_message, last_health_checked_at, created_at, updated_at
     FROM ai_settings
     WHERE id = ?
     LIMIT 1`,
    [requireTrimmed(providerId, "AI 配置 id 不能为空")]
  );

  return rows[0] ? mapSettingsRow(rows[0]) : null;
}

export async function getDefaultAIProviderSettings(
  runner?: MysqlQueryRunner
): Promise<DefaultAIProviderSettingsView | null> {
  return getAIProviderSettings(AI_SETTINGS_ID, runner);
}

export async function resolveRuntimeAIProviderConfig(
  runner?: MysqlQueryRunner,
  env?: AIProviderEnvironment
): Promise<RuntimeAIProviderConfig> {
  try {
    const row = await getSettingsSecret(AI_SETTINGS_ID, resolveRunner(runner));
    return {
      provider: "openai-compatible",
      apiKey: decryptSecret(secretFromRow(row), env),
      baseUrl: normalizeOpenAIBaseUrl(row.base_url),
      model: row.model
    };
  } catch {
    return resolveEnvRuntimeConfig(env);
  }
}

function healthMessageFromError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "AI 配置健康检查失败";
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
  const settingId = requireTrimmed(providerId, "AI 配置 id 不能为空");

  try {
    const settings = await getSettingsSecret(settingId, db);
    const apiKey = decryptSecret(secretFromRow(settings), env);
    await listOpenAICompatibleModels({ apiKey, baseUrl: settings.base_url }, fetchImpl);
    await db.query<ResultSetHeader>(
      `UPDATE ai_settings
       SET health_status = ?, health_message = ?, last_health_checked_at = ?
       WHERE id = ?`,
      ["healthy", null, checkedAt, settingId]
    );
    return { healthStatus: "healthy", healthMessage: null };
  } catch (error) {
    const message = healthMessageFromError(error);
    await db.query<ResultSetHeader>(
      `UPDATE ai_settings
       SET health_status = ?, health_message = ?, last_health_checked_at = ?
       WHERE id = ?`,
      ["unhealthy", message, checkedAt, settingId]
    );
    return { healthStatus: "unhealthy", healthMessage: message };
  }
}
