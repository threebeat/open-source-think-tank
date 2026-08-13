import {
  validateEmbedOrigin,
  type PublicInputProviderAdapter,
} from "@/lib/public-input/provider/adapter";
import type {
  OpaqueConversationRef,
  PublicInputProviderManifest,
} from "@/lib/public-input/provider/types";

const manifest: PublicInputProviderManifest = {
  providerId: "fixture",
  displayName: "Synthetic Public Input fixture provider",
  networkCallsAllowed: false,
  capabilities: [
    {
      id: "hosted_iframe_embed",
      status: "unsupported_forbidden",
      summary: "Fixture provider never embeds a live host.",
      sources: ["docs/decisions/0012-public-input-provider-boundary.md"],
    },
    {
      id: "agree_disagree_pass",
      status: "supported_documented",
      summary: "Local synthetic Agree/Disagree/Pass practice only.",
      sources: ["docs/phase-4-plan.md"],
    },
    {
      id: "report_generation",
      status: "supported_documented",
      summary: "Allowlisted aggregate fixture reports only.",
      sources: ["src/features/public-input/aggregate-report.ts"],
    },
    {
      id: "xid_identity_linkage",
      status: "unsupported_forbidden",
      summary: "xid forbidden until approved.",
      sources: ["docs/open-questions.md"],
    },
  ],
};

function isSyntheticTopicId(topicId: string): boolean {
  return topicId.startsWith("topic-") || topicId.startsWith("fixture-");
}

/**
 * Public-demo synthetic adapter. Uses opaque fixture tokens only.
 * Never performs network requests or returns raw provider URLs.
 */
export class FixturePublicInputAdapter implements PublicInputProviderAdapter {
  readonly name = "public-input-provider" as const;

  getManifest() {
    return manifest;
  }

  getLifecycleStatus(topicId: string) {
    if (!isSyntheticTopicId(topicId)) {
      return {
        ok: false as const,
        code: "INVALID_CONVERSATION_REF" as const,
        message: "Fixture provider accepts synthetic topic IDs only.",
      };
    }
    return {
      ok: true as const,
      value: { status: "synthetic_available" as const },
    };
  }

  resolveConversationRef(topicId: string) {
    if (!isSyntheticTopicId(topicId)) {
      return {
        ok: false as const,
        code: "INVALID_CONVERSATION_REF" as const,
        message: "Fixture conversation refs require synthetic topic IDs.",
      };
    }
    return {
      ok: true as const,
      value: {
        kind: "opaque_conversation_ref" as const,
        providerId: "fixture" as const,
        token: `fixture-conv:${topicId}`,
      },
    };
  }

  describeSafeEmbed(
    conversationRef: OpaqueConversationRef,
    proposedOrigin: string,
  ) {
    if (conversationRef.providerId !== "fixture") {
      return {
        ok: false as const,
        code: "INVALID_CONVERSATION_REF" as const,
        message: "Conversation ref provider mismatch.",
      };
    }
    const originCheck = validateEmbedOrigin(proposedOrigin);
    if (!originCheck.ok) {
      return originCheck;
    }
    return {
      ok: false as const,
      code: "UNSUPPORTED_CAPABILITY" as const,
      message:
        "Fixture provider rejects live embeds. Use synthetic aggregate reports only.",
    };
  }

  describeAggregateSnapshot(topicId: string) {
    if (!isSyntheticTopicId(topicId)) {
      return {
        ok: false as const,
        code: "INVALID_CONVERSATION_REF" as const,
        message: "Fixture aggregate snapshots require synthetic topic IDs.",
      };
    }
    return {
      ok: true as const,
      value: {
        kind: "versioned_aggregate_snapshot" as const,
        methodVersion: "public-input-aggregate@4.2.0-synthetic",
        importedAt: "2026-03-01T18:00:00.000Z",
        synthetic: true,
        topicId,
      },
    };
  }
}
