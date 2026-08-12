import { z } from "zod";

/**
 * Shared source-URL policy for create, edit, publish-readiness, and public
 * projection. Pure host classification only — never resolves DNS or fetches.
 */

export const SOURCE_URL_MAX_LENGTH = 2000;

export type SourceUrlErrorCategory =
  | "malformed"
  | "scheme"
  | "credentials"
  | "length"
  | "control_chars"
  | "empty_host"
  | "host_private"
  | "host_local"
  | "host_single_label"
  | "port"
  | "encoding";

export type SourceUrlSuccess = {
  ok: true;
  canonicalUrl: string;
  hostname: string;
};

export type SourceUrlFailure = {
  ok: false;
  category: SourceUrlErrorCategory;
  message: string;
};

export type SourceUrlResult = SourceUrlSuccess | SourceUrlFailure;

const CATEGORY_MESSAGES: Record<SourceUrlErrorCategory, string> = {
  malformed: "Enter a valid absolute https URL.",
  scheme: "Source URLs must use https.",
  credentials: "Source URLs cannot include a username or password.",
  length: `Source URLs must be at most ${SOURCE_URL_MAX_LENGTH} characters.`,
  control_chars: "Source URLs cannot include spaces or control characters.",
  empty_host: "Source URLs must include a public hostname.",
  host_private: "Source URLs cannot point to private or internal network addresses.",
  host_local: "Source URLs cannot use local or internal hostnames.",
  host_single_label: "Source URLs must use a fully qualified public hostname.",
  port: "Source URLs must use the default https port (443) for this alpha.",
  encoding: "Source URLs contain invalid percent encoding.",
};

export function sourceUrlErrorMessage(category: SourceUrlErrorCategory): string {
  return CATEGORY_MESSAGES[category];
}

function fail(category: SourceUrlErrorCategory): SourceUrlFailure {
  return { ok: false, category, message: CATEGORY_MESSAGES[category] };
}

function hasControlOrWhitespace(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function hasInvalidPercentEncoding(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== "%") continue;
    const hex = value.slice(i + 1, i + 3);
    if (hex.length < 2 || !/^[0-9A-Fa-f]{2}$/.test(hex)) {
      return true;
    }
  }
  return false;
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    // Reject leading-zero forms that are not a single zero.
    if (part.length > 1 && part.startsWith("0")) return null;
    octets.push(n);
  }
  return octets;
}

function ipv4ToInt(octets: number[]): number {
  return (
    ((octets[0]! << 24) >>> 0) +
    ((octets[1]! << 16) >>> 0) +
    ((octets[2]! << 8) >>> 0) +
    (octets[3]! >>> 0)
  );
}

function inCidr(octets: number[], base: number[], prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(octets) & mask) === (ipv4ToInt(base) & mask);
}

function isPrivateOrBlockedIpv4(octets: number[]): boolean {
  // 0.0.0.0/8 unspecified
  if (inCidr(octets, [0, 0, 0, 0], 8)) return true;
  // 127.0.0.0/8 loopback
  if (inCidr(octets, [127, 0, 0, 0], 8)) return true;
  // 10.0.0.0/8
  if (inCidr(octets, [10, 0, 0, 0], 8)) return true;
  // 172.16.0.0/12
  if (inCidr(octets, [172, 16, 0, 0], 12)) return true;
  // 192.168.0.0/16
  if (inCidr(octets, [192, 168, 0, 0], 16)) return true;
  // 169.254.0.0/16 link-local (includes 169.254.169.254 metadata)
  if (inCidr(octets, [169, 254, 0, 0], 16)) return true;
  // 100.64.0.0/10 carrier-grade NAT
  if (inCidr(octets, [100, 64, 0, 0], 10)) return true;
  // 224.0.0.0/4 multicast
  if (inCidr(octets, [224, 0, 0, 0], 4)) return true;
  // 255.255.255.255 broadcast
  if (octets.every((n) => n === 255)) return true;
  return false;
}

function expandIpv6(host: string): number[] | null {
  const raw = host.toLowerCase();
  if (!raw.includes(":")) return null;
  if (raw.includes(".")) {
    // IPv4-mapped handled separately via URL hostname forms like ::ffff:x.x.x.x
    const lastColon = raw.lastIndexOf(":");
    const v4 = parseIpv4(raw.slice(lastColon + 1));
    if (!v4) return null;
    const head = raw.slice(0, lastColon);
    const mapped = expandIpv6(`${head}:${((v4[0]! << 8) | v4[1]!).toString(16)}:${((v4[2]! << 8) | v4[3]!).toString(16)}`);
    return mapped;
  }
  const sides = raw.split("::");
  if (sides.length > 2) return null;
  const left = sides[0] ? sides[0].split(":").filter(Boolean) : [];
  const right = sides.length === 2 && sides[1] ? sides[1].split(":").filter(Boolean) : [];
  if (sides.length === 1 && left.length !== 8) return null;
  const missing = 8 - (left.length + right.length);
  if (sides.length === 2 && missing < 0) return null;
  const groups = [
    ...left,
    ...(sides.length === 2 ? Array.from({ length: missing }, () => "0") : []),
    ...right,
  ];
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(Number.parseInt(g, 16));
  }
  return out;
}

function isIpv4MappedPrivate(groups: number[]): boolean {
  // ::ffff:0:0/96
  const mapped =
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff;
  if (!mapped) return false;
  const hi = groups[6]!;
  const lo = groups[7]!;
  const octets = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
  return isPrivateOrBlockedIpv4(octets);
}

function isBlockedIpv6(groups: number[]): boolean {
  // :: / unspecified
  if (groups.every((g) => g === 0)) return true;
  // ::1 loopback
  if (
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0 &&
    groups[6] === 0 &&
    groups[7] === 1
  ) {
    return true;
  }
  // fe80::/10 link-local
  if ((groups[0]! & 0xffc0) === 0xfe80) return true;
  // fc00::/7 unique local
  if ((groups[0]! & 0xfe00) === 0xfc00) return true;
  // ff00::/8 multicast
  if ((groups[0]! & 0xff00) === 0xff00) return true;
  if (isIpv4MappedPrivate(groups)) return true;
  return false;
}

function classifyHostname(hostname: string): SourceUrlErrorCategory | null {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return "empty_host";

  if (host === "localhost" || host.endsWith(".localhost")) {
    return "host_local";
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    return "host_local";
  }

  const ipv4 = parseIpv4(host);
  if (ipv4) {
    return isPrivateOrBlockedIpv4(ipv4) ? "host_private" : null;
  }

  const ipv6 = expandIpv6(host);
  if (ipv6) {
    return isBlockedIpv6(ipv6) ? "host_private" : null;
  }

  // Bracketed IPv6 that failed to parse → treat as malformed host_private-ish.
  if (hostname.startsWith("[")) {
    return "host_private";
  }

  // Single-label (no dot) hostnames are rejected.
  if (!host.includes(".")) {
    return "host_single_label";
  }

  return null;
}

/**
 * Validate and canonicalize a source URL for storage / projection.
 * Does not perform network I/O.
 */
export function validateSourceUrl(raw: string): SourceUrlResult {
  if (typeof raw !== "string") {
    return fail("malformed");
  }
  if (raw.length > SOURCE_URL_MAX_LENGTH) {
    return fail("length");
  }
  if (hasControlOrWhitespace(raw)) {
    return fail("control_chars");
  }
  if (hasInvalidPercentEncoding(raw)) {
    return fail("encoding");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fail("malformed");
  }

  if (parsed.protocol !== "https:") {
    return fail("scheme");
  }
  if (parsed.username || parsed.password) {
    return fail("credentials");
  }
  if (!parsed.hostname) {
    return fail("empty_host");
  }
  // Reject protocol-relative leftovers and empty hosts after parse.
  if (parsed.host.startsWith(":") || parsed.hostname === "") {
    return fail("empty_host");
  }

  const port = parsed.port;
  if (port && port !== "443") {
    return fail("port");
  }

  const hostIssue = classifyHostname(parsed.hostname);
  if (hostIssue) {
    return fail(hostIssue);
  }

  // Re-check path/query/fragment for control characters after decode-safe parse.
  const remainder = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (hasControlOrWhitespace(remainder)) {
    return fail("control_chars");
  }

  // Canonical form from the platform URL parser (hostname lowercased by URL).
  const canonicalUrl = parsed.href;
  if (canonicalUrl.length > SOURCE_URL_MAX_LENGTH) {
    return fail("length");
  }

  return {
    ok: true,
    canonicalUrl,
    hostname: parsed.hostname.toLowerCase().replace(/^\[|\]$/g, ""),
  };
}

/** True when the value is an accepted canonical https source URL. */
export function isAllowedSourceUrl(value: string): boolean {
  return validateSourceUrl(value).ok;
}

/** Hostname-only audit field; never path/query/fragment. */
export function sourceUrlHostname(value: string): string | null {
  const result = validateSourceUrl(value);
  return result.ok ? result.hostname : null;
}

/**
 * Zod schema for source URLs. On success, transforms to the canonical href.
 */
export const sourceUrlSchema = z
  .string()
  .trim()
  .min(1, { message: CATEGORY_MESSAGES.malformed })
  .max(SOURCE_URL_MAX_LENGTH, { message: CATEGORY_MESSAGES.length })
  .superRefine((value, ctx) => {
    const result = validateSourceUrl(value);
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.message,
        params: { category: result.category },
      });
    }
  })
  .transform((value) => {
    const result = validateSourceUrl(value);
    if (!result.ok) {
      // Unreachable after superRefine; keep type narrowing honest.
      return value;
    }
    return result.canonicalUrl;
  });
