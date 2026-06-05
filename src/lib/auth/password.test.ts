import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, verifyPassword } from "./password";

describe("normalizeEmail", () => {
  it("trims and lowercases email", () => {
    expect(normalizeEmail("  Author@Example.COM  ")).toBe("author@example.com");
  });

  it("rejects blank email", () => {
    expect(() => normalizeEmail("   ")).toThrow("邮箱不能为空");
  });
});

describe("password hashing", () => {
  it("hashes and verifies a password without storing plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).toMatch(/^scrypt:v1:/);
    expect(hash).not.toContain("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("rejects short passwords", async () => {
    await expect(hashPassword("12345")).rejects.toThrow("密码至少需要 8 个字符");
  });
});
