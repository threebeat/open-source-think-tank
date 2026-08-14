import { describe, expect, it } from "vitest";

import {
  hashPassword,
  isEmailShapedIdentifier,
  normalizeIdentifier,
  PASSWORD_SCHEME,
  validatePassword,
  verifyPassword,
} from "@/lib/auth/passwords";

describe("password hashing", () => {
  it("hashes with scrypt_n32768 and verifies in constant-time compare", async () => {
    const password = "a-sufficiently-long-pass";
    const hash = await hashPassword(password);
    expect(hash.startsWith(`${PASSWORD_SCHEME}$`)).toBe(true);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("a-sufficiently-long-pass!", hash)).toBe(false);
  });

  it("rejects identifier-shaped passwords and short secrets", () => {
    expect(validatePassword("short", "a@b.example").ok).toBe(false);
    expect(
      validatePassword("member@ostt.synth.test", "member@ostt.synth.test").ok,
    ).toBe(false);
    expect(validatePassword("a-sufficiently-long-pass", "member@ostt.synth.test").ok).toBe(
      true,
    );
  });

  it("normalizes identifiers to lowercase email-shaped values", () => {
    expect(normalizeIdentifier("  Alex@Hall.Example ")).toBe("alex@hall.example");
    expect(isEmailShapedIdentifier("alex@hall.example")).toBe(true);
    expect(isEmailShapedIdentifier("not-an-email")).toBe(false);
    expect(isEmailShapedIdentifier("a@b")).toBe(false);
  });
});
