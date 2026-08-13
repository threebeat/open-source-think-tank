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
 * Implementations must not perform network requests in Phase 4.2.
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
   * Build a safe embed descriptor for a future 4.3 iframe.
   * Rejects unsafe hosts and credential-bearing URLs.
   */
  describeSafeEmbed(
    conversationRef: OpaqueConversationRef,
    proposedOrigin: string,
  ): PublicInputProviderResult<SafeEmbedDescriptor>;
  describeAggregateSnapshot(
    topicId: string,
  ): PublicInputProviderResult<VersionedAggregateSnapshotDescriptor>;
}

const ALLOWED_HOST_SUFFIXES = ["pol.is", "localhost"] as const;

export function isHttpsOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export function originHasCredentials(origin: string): boolean {
  try {
    const url = new URL(origin);
    return Boolean(url.username || url.password || /[?&](token|access_token|key|secret)=/i.test(url.search));
  } catch {
    return true;
  }
}

export function isAllowlistedEmbedHost(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

export function validateEmbedOrigin(
  proposedOrigin: string,
): PublicInputProviderResult<{ origin: string }> {
  if (!isHttpsOrigin(proposedOrigin)) {
    return {
      ok: false,
      code: "UNSAFE_EMBED_ORIGIN",
      message: "Embed origin must use HTTPS (or localhost for engineering).",
    };
  }
  if (originHasCredentials(proposedOrigin)) {
    return {
      ok: false,
      code: "CREDENTIAL_BEARING_URL_REJECTED",
      message: "Credential-bearing or secret-query embed URLs are rejected.",
    };
  }
  if (!isAllowlistedEmbedHost(proposedOrigin)) {
    return {
      ok: false,
      code: "UNSAFE_EMBED_ORIGIN",
      message: "Embed origin is not on the exact host allowlist.",
    };
  }
  return { ok: true, value: { origin: proposedOrigin } };
}
