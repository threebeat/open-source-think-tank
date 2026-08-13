import type { PublicInputProviderAdapter } from "@/lib/public-input/provider/adapter";
import {
  PUBLIC_INPUT_PROVIDER_UNAVAILABLE,
  type PublicInputProviderManifest,
} from "@/lib/public-input/provider/types";

const manifest: PublicInputProviderManifest = {
  providerId: "no-provider",
  displayName: "No Public Input provider",
  networkCallsAllowed: false,
  capabilities: [
    {
      id: "hosted_iframe_embed",
      status: "unsupported_forbidden",
      summary: "No provider configured; embed unavailable.",
      sources: ["docs/public-input-provider-assessment.md"],
    },
    {
      id: "xid_identity_linkage",
      status: "unsupported_forbidden",
      summary: "xid remains forbidden until approved.",
      sources: ["docs/decisions/0012-public-input-provider-boundary.md"],
    },
  ],
};

/**
 * Fail-closed adapter used when no consultation provider is authorized.
 * Makes zero network calls.
 */
export class NoProviderPublicInputAdapter implements PublicInputProviderAdapter {
  readonly name = "public-input-provider" as const;

  getManifest() {
    return manifest;
  }

  getLifecycleStatus(_topicId: string) {
    return {
      ok: false as const,
      code: PUBLIC_INPUT_PROVIDER_UNAVAILABLE,
      message: "No Public Input provider is configured for this environment.",
    };
  }

  resolveConversationRef(_topicId: string) {
    return {
      ok: false as const,
      code: PUBLIC_INPUT_PROVIDER_UNAVAILABLE,
      message: "Conversation mapping requires an authorized provider.",
    };
  }

  describeSafeEmbed() {
    return {
      ok: false as const,
      code: PUBLIC_INPUT_PROVIDER_UNAVAILABLE,
      message: "Safe embed descriptors are unavailable without a provider.",
    };
  }

  describeAggregateSnapshot(_topicId: string) {
    return {
      ok: false as const,
      code: PUBLIC_INPUT_PROVIDER_UNAVAILABLE,
      message: "Aggregate snapshots are unavailable without a provider.",
    };
  }
}
