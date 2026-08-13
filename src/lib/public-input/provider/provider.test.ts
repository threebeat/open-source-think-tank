import { describe, expect, it } from "vitest";

import {
  FixturePublicInputAdapter,
  NoProviderPublicInputAdapter,
  PUBLIC_INPUT_PROVIDER_UNAVAILABLE,
  validateEmbedOrigin,
} from "@/lib/public-input/provider";

describe("public-input provider boundary", () => {
  it("fixture provider works only with synthetic topic IDs and never networks", () => {
    const adapter = new FixturePublicInputAdapter();
    expect(adapter.getManifest().networkCallsAllowed).toBe(false);
    expect(adapter.getManifest().providerId).toBe("fixture");
    const ok = adapter.resolveConversationRef(
      "topic-cedar-river-drought-surcharge",
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.token).toMatch(/^fixture-conv:/);
      expect(ok.value.token).not.toMatch(/^https?:/i);
    }
    expect(adapter.resolveConversationRef("acct-live-1").ok).toBe(false);
    const embed = adapter.describeSafeEmbed(
      {
        kind: "opaque_conversation_ref",
        providerId: "fixture",
        token: "fixture-conv:topic-x",
      },
      "https://pol.is",
    );
    expect(embed.ok).toBe(false);
    if (!embed.ok) {
      expect(embed.code).toBe("UNSUPPORTED_CAPABILITY");
    }
  });

  it("no-provider adapter fails closed with stable code", () => {
    const adapter = new NoProviderPublicInputAdapter();
    expect(adapter.getManifest().networkCallsAllowed).toBe(false);
    const status = adapter.getLifecycleStatus("topic-any");
    expect(status.ok).toBe(false);
    if (!status.ok) {
      expect(status.code).toBe(PUBLIC_INPUT_PROVIDER_UNAVAILABLE);
    }
    expect(adapter.describeAggregateSnapshot("topic-any").ok).toBe(false);
  });

  it("rejects unsafe origins and credential-bearing URLs", () => {
    expect(validateEmbedOrigin("http://pol.is").ok).toBe(false);
    expect(
      validateEmbedOrigin("https://pol.is/?access_token=secret").ok,
    ).toBe(false);
    expect(validateEmbedOrigin("https://evil.example/").ok).toBe(false);
    expect(validateEmbedOrigin("https://pol.is").ok).toBe(true);
  });

  it("marks xid as unsupported/forbidden in manifests", () => {
    const fixture = new FixturePublicInputAdapter().getManifest();
    const xid = fixture.capabilities.find((c) => c.id === "xid_identity_linkage");
    expect(xid?.status).toBe("unsupported_forbidden");
  });
});
