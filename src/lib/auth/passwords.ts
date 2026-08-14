import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/** scrypt N=32768, r=8, p=1, keylen=32 — stored scheme name. */
export const PASSWORD_SCHEME = "scrypt_n32768" as const;
export type PasswordScheme = typeof PASSWORD_SCHEME;

const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;
/** 128 * N * r is 32 MiB; OpenSSL requires a little headroom. */
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

const IDENTIFIER_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmailShapedIdentifier(value: string): boolean {
  if (value.length < 5 || value.length > 254) {
    return false;
  }
  return IDENTIFIER_PATTERN.test(value);
}

export function validatePassword(
  password: string,
  identifier: string,
): { ok: true } | { ok: false; error: string; code: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      code: "PASSWORD_TOO_SHORT",
    };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: "Password is too long.",
      code: "PASSWORD_TOO_LONG",
    };
  }
  if (password.toLowerCase() === identifier.toLowerCase()) {
    return {
      ok: false,
      error: "Password cannot match the identifier.",
      code: "PASSWORD_MATCHES_IDENTIFIER",
    };
  }
  return { ok: true };
}

function encodePart(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function decodePart(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

/**
 * Hash a password with scrypt. The returned string is stored in
 * account_credentials.password_hash. Never log or put in URLs.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = (await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  })) as Buffer;
  return `${PASSWORD_SCHEME}$${encodePart(salt)}$${encodePart(derived)}`;
}

/**
 * Constant-time verify. Returns false for malformed stored hashes.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== PASSWORD_SCHEME) {
    await hashPassword(password);
    return false;
  }
  const salt = decodePart(parts[1]!);
  const expected = decodePart(parts[2]!);
  if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) {
    await hashPassword(password);
    return false;
  }
  const derived = (await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  })) as Buffer;
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
