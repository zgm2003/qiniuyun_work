import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secret-encryption";

function envWithMasterKey(key = randomBytes(32)): Record<string, string> {
  return {
    AI_CONFIG_MASTER_KEY: key.toString("base64")
  };
}

describe("secret encryption", () => {
  it("encrypts the same plaintext with different IVs and decrypts it back", () => {
    const env = envWithMasterKey();

    const first = encryptSecret("sk-live-secret", env);
    const second = encryptSecret("sk-live-secret", env);

    expect(first.version).toBe(1);
    expect(second.version).toBe(1);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(decryptSecret(first, env)).toBe("sk-live-secret");
    expect(decryptSecret(second, env)).toBe("sk-live-secret");
  });

  it("fails loudly when the master key is missing or malformed", () => {
    expect(() => encryptSecret("sk-live-secret", {})).toThrow("AI_CONFIG_MASTER_KEY 未配置");
    expect(() =>
      encryptSecret("sk-live-secret", {
        AI_CONFIG_MASTER_KEY: Buffer.from("short").toString("base64")
      })
    ).toThrow("AI_CONFIG_MASTER_KEY 必须是 base64 编码的 32 bytes 密钥");
  });

  it("fails loudly for empty plaintext and wrong decryption key", () => {
    const env = envWithMasterKey();
    const wrongEnv = envWithMasterKey();
    const encrypted = encryptSecret("sk-live-secret", env);

    expect(() => encryptSecret("   ", env)).toThrow("API Key 不能为空");
    expect(() => decryptSecret(encrypted, wrongEnv)).toThrow("密钥解密失败");
  });
});
