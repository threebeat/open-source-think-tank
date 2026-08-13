import type {
  OpaqueConversationRef,
  PublicInputLifecycleStatus,
  PublicInputProviderManifest,
  PublicInputProviderResult,
  SafeEmbedDescriptor,
  VersionedAggregateSnapshotDescriptor,
} from "@/lib/public-input/provider/types";

/**
 * Provider-neutral Public Input adapter boundary.
 *
 * Phase 4.2 implementations must not perform network requests. Phase 4.3
 * extends this boundary with a gated conversation lifecycle
 * (`src/lib/public-input/lifecycle/`), a hand-off embed-URL constructor
 * (`src/lib/public-input/lifecycle/embed-url.ts`), and an activation
 * checklist (`src/lib/public-input/lifecycle/activation.ts`). No 4.3 code
 * renders an iframe, opens a provider network connection, reads provider
 * credentials/env vars, or returns a live embed URL — `describeSafeEmbed`
 * below and the 4.3 embed-url module both remain fail-closed until every
 * activation gate is explicitly resolved by a future, separately-authorized
 * package (docs/phase-4-plan.md §4, §12; ADR 0012).
 */
export interface PublicInputProviderAdapter {
  readonly name: "public-input-provider";
  getManifest(): PublicInputProviderManifest;
  getLifecycleStatus(topicId: string): PublicInputProviderResult<{
    status: PublicInputLifecycleStatus;
  }>;
  /**
   * Map institutional topic ID → opaque conversation ref.
   * Does not create provider conversations or call networks.
   */
  resolveConversationRef(
    topicId: string,
  ): PublicInputProviderResult<OpaqueConversationRef>;
  /**
   * Build a safe embed descriptor. Rejects unsafe hosts and credential-bearing
   * URLs. Still never returns an activatable live embed in Phase 4.3 — see
   * `src/lib/public-input/lifecycle/embed-url.ts` for the fail-closed
   * construction path consulted by any future UI package.
   */
  describeSafeEmbed(
    conversationRef: OpaqueConversationRef,
    proposedOrigin: string,
  ): PublicInputProviderResult<SafeEmbedDescriptor>;
  describeAggregateSnapshot(
    topicId: string,
  ): PublicInputProviderResult<VersionedAggregateSnapshotDescriptor>;
}

/**
 * Exact-match origin allowlist (never a hostname suffix match). Adding an
 * origin here is a code change reviewable by itself — never derived from
 * user input, env vars, or provider responses.
 */
const EXACT_ALLOWED_PRODUCTION_ORIGINS = new Set<string>(["https://pol.is"]);

const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/localhost(:\d+)?$/;

/**
 * Localhost is only ever allowed when explicitly opted in via
 * `OSTT_ALLOW_LOCALHOST_EMBED_ORIGIN=1` **and** `NODE_ENV` is not
 * `"production"` — never a bare "is it dev" heuristic that could silently
 * apply in a real deployment.
 */
export function allowsLocalhostEmbedOrigin(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.OSTT_ALLOW_LOCALHOST_EMBED_ORIGIN === "1" &&
    env.NODE_ENV !== "production"
  );
}

export function isHttpsOrigin(
  origin: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol === "https:") {
      return true;
    }
    return (
      LOCALHOST_ORIGIN_PATTERN.test(origin) && allowsLocalhostEmbedOrigin(env)
    );
  } catch {
    return false;
  }
}

export function originHasCredentials(origin: string): boolean {
  try {
    const url = new URL(origin);
    return Boolean(
      url.username ||
        url.password ||
        url.search.length > 0 ||
        /[?&](token|access_token|key|secret|xid)=/i.test(url.search),
    );
  } catch {
    return true;
  }
}

/**
 * Exact origin match only (never `endsWith`/suffix matching, which would
 * also accept an attacker-registered `evilpol.is`). Localhost is accepted
 * only through {@link allowsLocalhostEmbedOrigin}.
 */
export function isAllowlistedEmbedHost(
  origin: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (EXACT_ALLOWED_PRODUCTION_ORIGINS.has(origin)) {
    return true;
  }
  return (
    LOCALHOST_ORIGIN_PATTERN.test(origin) && allowsLocalhostEmbedOrigin(env)
  );
}

export function validateEmbedOrigin(
  proposedOrigin: string,
  env: Record<string, string | undefined> = process.env,
): PublicInputProviderResult<{ origin: string }> {
  if (!isHttpsOrigin(proposedOrigin, env)) {
    return {
      ok: false,
      code: "UNSAFE_EMBED_ORIGIN",
      message:
        "Embed origin must use HTTPS (localhost only under an explicit development/test opt-in).",
    };
  }
  if (originHasCredentials(proposedOrigin)) {
    return {
      ok: false,
      code: "CREDENTIAL_BEARING_URL_REJECTED",
      message:
        "Credential-bearing, token-bearing, or query-string embed origins are rejected.",
    };
  }
  if (!isAllowlistedEmbedHost(proposedOrigin, env)) {
    return {
      ok: false,
      code: "UNSAFE_EMBED_ORIGIN",
      message: "Embed origin is not on the exact allowlist.",
    };
  }
  return { ok: true, value: { origin: proposedOrigin } };
}
