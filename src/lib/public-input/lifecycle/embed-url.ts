import {
  isLiveProviderActivationComplete,
} from "@/lib/public-input/lifecycle/activation";
import type {
  OperationalProviderKind,
  PublicInputProviderKind,
} from "@/lib/public-input/lifecycle/repository";
import { validateEmbedOrigin } from "@/lib/public-input/provider/adapter";

/**
 * Fail-closed embed URL construction (Phase 4.3 domain layer only — no UI
 * wiring, no iframe, no network call anywhere in this module).
 *
 * Every input is validated (kind → opaque ref shape → exact origin) before
 * the final activation-gate check runs, so callers/tests can distinguish
 * "your input was invalid" from "live embeds are not authorized yet". The
 * activation check always fails today (see activation.ts) — this module can
 * never return `ok: true` until a future, separately-authorized package
 * resolves every gate.
 */

export type EmbedUrlErrorCode =
  | "LIVE_PROVIDER_KIND_FORBIDDEN"
  | "PROVIDER_KIND_HAS_NO_EMBED"
  | "INVALID_CONVERSATION_REF"
  | "UNSAFE_EMBED_ORIGIN"
  | "CREDENTIAL_BEARING_URL_REJECTED"
  | "EMBED_ACTIVATION_GATES_UNRESOLVED";

export type EmbedUrlResult =
  | {
      ok: true;
      value: { url: string; providerKind: OperationalProviderKind };
    }
  | { ok: false; code: EmbedUrlErrorCode; message: string };

/**
 * Fixed, environment-owned origin for the (currently inactive) fixture embed
 * path. Never derived from a request, env var, or provider response.
 */
export const FIXTURE_EMBED_ORIGIN = "https://pol.is" as const;

/** Fixed path template — never includes a query string or arbitrary segments. */
function buildPathTemplate(conversationRef: string): string {
  return `/${encodeURIComponent(conversationRef)}`;
}

/**
 * Opaque refs are internal tokens (e.g. `fixture-conv:<topicId>`), never a
 * URL, email, session id, or xid. Reject anything that doesn't match the
 * narrow allowed shape, and explicitly reject known-dangerous substrings even
 * if a future shape change would otherwise match the charset.
 */
const OPAQUE_REF_PATTERN = /^[a-z][a-z0-9_-]{1,40}:[A-Za-z0-9_-]{1,200}$/;

const FORBIDDEN_REF_SUBSTRINGS = [
  "@",
  "://",
  "?",
  "&",
  "=",
  " ",
  "xid",
  "session",
  "password",
  "token",
];

export function isValidOpaqueConversationRef(ref: string): boolean {
  if (!OPAQUE_REF_PATTERN.test(ref)) {
    return false;
  }
  const lower = ref.toLowerCase();
  return !FORBIDDEN_REF_SUBSTRINGS.some((needle) => lower.includes(needle));
}

export function buildEmbedUrl(input: {
  providerKind: PublicInputProviderKind;
  conversationRef: string;
}): EmbedUrlResult {
  if (input.providerKind === "polis_hosted" || input.providerKind === "polis_self_hosted") {
    return {
      ok: false,
      code: "LIVE_PROVIDER_KIND_FORBIDDEN",
      message:
        "Live Pol.is provider kinds are not operational; no embed URL is ever constructed for them.",
    };
  }
  if (input.providerKind === "none") {
    return {
      ok: false,
      code: "PROVIDER_KIND_HAS_NO_EMBED",
      message: "No provider is mapped; there is nothing to embed.",
    };
  }

  if (!isValidOpaqueConversationRef(input.conversationRef)) {
    return {
      ok: false,
      code: "INVALID_CONVERSATION_REF",
      message:
        "Conversation reference is not a recognized opaque token shape.",
    };
  }

  const originCheck = validateEmbedOrigin(FIXTURE_EMBED_ORIGIN);
  if (!originCheck.ok) {
    return originCheck.code === "CREDENTIAL_BEARING_URL_REJECTED"
      ? {
          ok: false,
          code: "CREDENTIAL_BEARING_URL_REJECTED",
          message: originCheck.message,
        }
      : {
          ok: false,
          code: "UNSAFE_EMBED_ORIGIN",
          message: originCheck.message,
        };
  }

  // Every input validated. Live construction still fails closed unless every
  // activation gate is resolved — see activation.ts. This can never be true
  // in this package.
  if (!isLiveProviderActivationComplete()) {
    return {
      ok: false,
      code: "EMBED_ACTIVATION_GATES_UNRESOLVED",
      message:
        "Public Input embeds are not authorized yet; every activation gate remains unresolved.",
    };
  }

  // Unreachable while any activation gate is unresolved — kept explicit
  // (rather than removed) so a future authorized package's diff is small
  // and reviewable, and so this module documents the intended final shape.
  const url = `${originCheck.value.origin}${buildPathTemplate(input.conversationRef)}`;
  return { ok: true, value: { url, providerKind: "fixture" } };
}

/** Validates a caller-proposed origin against the exact allowlist without constructing a URL. */
export function validateProposedEmbedOrigin(origin: string) {
  return validateEmbedOrigin(origin);
}
