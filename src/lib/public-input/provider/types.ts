/**
 * Provider-neutral Public Input domain types (Phase 4.2).
 * Institutional topic IDs remain the source of truth. Provider conversation IDs
 * are opaque references only — never columns on topics/claims/evidence.
 */

export const PUBLIC_INPUT_PROVIDER_UNAVAILABLE =
  "PUBLIC_INPUT_PROVIDER_UNAVAILABLE" as const;

export type PublicInputProviderId =
  | "fixture"
  | "no-provider"
  | "polis-hosted"
  | "polis-self-hosted";

export type PublicInputCapabilityStatus =
  | "supported_documented"
  | "observed_unsupported"
  | "unclear_requires_confirmation"
  | "unsupported_forbidden";

export type PublicInputCapabilityId =
  | "hosted_iframe_embed"
  | "conversation_create"
  | "participant_comment"
  | "agree_disagree_pass"
  | "moderation_strict_permissive"
  | "report_generation"
  | "export_versioned"
  | "anonymous_participation"
  | "cookies_device_continuity"
  | "oidc_jwt"
  | "xid_identity_linkage"
  | "anonymous_but_verified"
  | "single_use_urls"
  | "accessibility"
  | "mobile"
  | "data_residency"
  | "subprocessors"
  | "encryption"
  | "retention_deletion"
  | "participant_export"
  | "breach_notification"
  | "outage_sla"
  | "rate_limits"
  | "api_version_compat"
  | "self_hosted_ops"
  | "license_obligations";

export type PublicInputCapabilityDeclaration = {
  id: PublicInputCapabilityId;
  status: PublicInputCapabilityStatus;
  summary: string;
  sources: string[];
};

/** Opaque conversation reference — never a raw provider URL or secret. */
export type OpaqueConversationRef = {
  readonly kind: "opaque_conversation_ref";
  readonly providerId: PublicInputProviderId;
  /** Opaque token; not a URL; not a secret-bearing report link. */
  readonly token: string;
};

export type SafeEmbedDescriptor = {
  readonly kind: "safe_embed_descriptor";
  readonly httpsRequired: true;
  readonly hostAllowlist: readonly string[];
  readonly conversationRef: OpaqueConversationRef;
  readonly credentialsInUrlAllowed: false;
  readonly arbitraryQueryForwardingAllowed: false;
  /** Documented for 4.3; not applied as a live iframe in 4.2. */
  readonly restrictiveIframePolicyNote: string;
};

export type PublicInputLifecycleStatus =
  | "not_configured"
  | "synthetic_available"
  | "provider_unavailable"
  | "unsupported_capability";

export type VersionedAggregateSnapshotDescriptor = {
  readonly kind: "versioned_aggregate_snapshot";
  readonly methodVersion: string;
  readonly importedAt: string;
  readonly synthetic: boolean;
  readonly topicId: string;
};

export type PublicInputProviderResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code:
        | typeof PUBLIC_INPUT_PROVIDER_UNAVAILABLE
        | "UNSUPPORTED_CAPABILITY"
        | "UNSAFE_EMBED_ORIGIN"
        | "CREDENTIAL_BEARING_URL_REJECTED"
        | "INVALID_CONVERSATION_REF";
      message: string;
    };

export type PublicInputProviderManifest = {
  providerId: PublicInputProviderId;
  displayName: string;
  networkCallsAllowed: false;
  capabilities: PublicInputCapabilityDeclaration[];
};
