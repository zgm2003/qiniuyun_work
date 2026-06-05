import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_PREFIX = "scrypt:v1";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("邮箱不能为空");
  }

  return normalized;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error("密码至少需要 8 个字符");
  }

  const salt = randomBytes(SALT_BYTES);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${PASSWORD_PREFIX}:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, version, saltText, keyText] = storedHash.split(":");
  if (`${algorithm}:${version}` !== PASSWORD_PREFIX || !saltText || !keyText) {
    return false;
  }

  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(keyText, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
