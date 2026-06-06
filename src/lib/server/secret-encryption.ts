import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type SecretEnvironment = Record<string, string | undefined>;

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  version: number;
};

const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const CURRENT_VERSION = 1;

function requireMasterKey(env: SecretEnvironment = process.env): Buffer {
  const encoded = env.AI_CONFIG_MASTER_KEY;
  if (!encoded) {
    throw new Error("AI_CONFIG_MASTER_KEY 未配置");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("AI_CONFIG_MASTER_KEY 必须是 base64 编码的 32 bytes 密钥");
  }

  return key;
}

function decodeBase64Field(value: string, fieldName: string, expectedLength?: number): Buffer {
  const decoded = Buffer.from(value, "base64");
  if (expectedLength !== undefined && decoded.length !== expectedLength) {
    throw new Error(`${fieldName} 格式错误`);
  }

  return decoded;
}

export function encryptSecret(plaintext: string, env?: SecretEnvironment): EncryptedSecret {
  if (!plaintext.trim()) {
    throw new Error("API Key 不能为空");
  }

  const key = requireMasterKey(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    version: CURRENT_VERSION
  };
}

export function decryptSecret(secret: EncryptedSecret, env?: SecretEnvironment): string {
  if (secret.version !== CURRENT_VERSION) {
    throw new Error(`不支持的密钥版本：${secret.version}`);
  }

  try {
    const key = requireMasterKey(env);
    const iv = decodeBase64Field(secret.iv, "api_key_iv", IV_BYTES);
    const authTag = decodeBase64Field(secret.authTag, "api_key_auth_tag", AUTH_TAG_BYTES);
    const ciphertext = decodeBase64Field(secret.ciphertext, "api_key_ciphertext");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("AI_CONFIG_MASTER_KEY")) {
      throw error;
    }
    throw new Error("密钥解密失败");
  }
}
