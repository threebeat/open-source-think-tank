import { createHash, createHmac } from "node:crypto";

/**
 * Trusted-proxy request-origin references for mutation rate limiting.
 *
 * Default: do not trust forwarded client IP headers. When
 * `TRUSTED_PROXY_HOPS` is a positive integer, take the client address from
 * `X-Forwarded-For` by counting that many trusted proxy hops from the right.
 * Never return or log the raw address — only an opaque keyed reference.
 */

export type RequestOriginRef =
  | { ok: true; originRef: string }
  | { ok: false; reason: "untrusted_proxy" | "missing" | "invalid" };

function hmacOrHash(material: string): string {
  const key =
    process.env.AUTH_SECRET ?? process.env.SECURITY_LOG_HMAC_KEY ?? null;
  if (key) {
    return `orig_${createHmac("sha256", key).update(material).digest("hex").slice(0, 24)}`;
  }
  return `orig_${createHash("sha256").update(`unkeyed:${material}`).digest("hex").slice(0, 24)}`;
}

function trustedProxyHops(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 10) return null;
  return n;
}

function looksLikeIp(value: string): boolean {
  if (!value || value.length > 128) return false;
  if (value.includes(" ")) return false;
  // Basic IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return true;
  // Basic IPv6 (including compressed)
  if (/^[0-9a-f:]+$/i.test(value) && value.includes(":")) return true;
  return false;
}

/**
 * Derive an opaque origin reference when trusted proxy provenance exists.
 * Otherwise omit the origin bucket (`ok: false`).
 */
export function resolveRequestOriginRef(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): RequestOriginRef {
  const hops = trustedProxyHops(env);
  if (hops == null) {
    return { ok: false, reason: "untrusted_proxy" };
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded?.trim()) {
    return { ok: false, reason: "missing" };
  }

  const parts = forwarded
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < hops) {
    return { ok: false, reason: "invalid" };
  }

  // Rightmost hops are trusted proxies; client is immediately left of them.
  const clientIndex = parts.length - hops - 1;
  if (clientIndex < 0) {
    return { ok: false, reason: "invalid" };
  }
  const client = parts[clientIndex]!;
  if (!looksLikeIp(client)) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, originRef: hmacOrHash(`origin:${client}`) };
}
