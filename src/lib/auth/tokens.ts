import { createHash, randomBytes } from "node:crypto";

/** Generate an opaque URL-safe secret. Never log or persist the raw value. */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newEntityId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}
