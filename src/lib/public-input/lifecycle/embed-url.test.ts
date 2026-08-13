import { describe, expect, it } from "vitest";

import {
  FIXTURE_EMBED_ORIGIN,
  buildEmbedUrl,
  isValidOpaqueConversationRef,
  validateProposedEmbedOrigin,
} from "@/lib/public-input/lifecycle/embed-url";

describe("Public Input embed-url construction (4.3, fail-closed)", () => {
  it("accepts a well-shaped opaque fixture conversation ref", () => {
    expect(isValidOpaqueConversationRef("fixture-conv:abc123XYZ_-")).toBe(
      true,
    );
  });

  it("rejects raw URLs, emails, and query-bearing values", () => {
    expect(isValidOpaqueConversationRef("https://pol.is/abc")).toBe(false);
    expect(isValidOpaqueConversationRef("mailto:a@b.com")).toBe(false);
    expect(isValidOpaqueConversationRef("someone@example.com")).toBe(false);
    expect(isValidOpaqueConversationRef("fixture-conv:abc?x=1")).toBe(false);
    expect(isValidOpaqueConversationRef("fixture-conv:abc&y=2")).toBe(false);
    expect(isValidOpaqueConversationRef("fixture-conv:has space")).toBe(
      false,
    );
  });

  it("rejects xid, session, password, and token-shaped substrings even if charset-legal", () => {
    expect(isValidOpaqueConversationRef("fixture-conv:xid-12345")).toBe(
      false,
    );
    expect(
      isValidOpaqueConversationRef("fixture-conv:session-abc123"),
    ).toBe(false);
    expect(
      isValidOpaqueConversationRef("fixture-conv:password-abc123"),
    ).toBe(false);
    expect(isValidOpaqueConversationRef("fixture-conv:token-abc123")).toBe(
      false,
    );
  });

  it("rejects a bare id with no kind prefix", () => {
    expect(isValidOpaqueConversationRef("abc123")).toBe(false);
    expect(isValidOpaqueConversationRef("")).toBe(false);
  });

  it("buildEmbedUrl refuses live provider kinds outright (no ref/origin check needed)", () => {
    const hosted = buildEmbedUrl({
      providerKind: "polis_hosted",
      conversationRef: "fixture-conv:whatever",
    });
    expect(hosted.ok).toBe(false);
    if (!hosted.ok) expect(hosted.code).toBe("LIVE_PROVIDER_KIND_FORBIDDEN");

    const selfHosted = buildEmbedUrl({
      providerKind: "polis_self_hosted",
      conversationRef: "fixture-conv:whatever",
    });
    expect(selfHosted.ok).toBe(false);
    if (!selfHosted.ok) {
      expect(selfHosted.code).toBe("LIVE_PROVIDER_KIND_FORBIDDEN");
    }
  });

  it("buildEmbedUrl refuses when no provider is mapped", () => {
    const none = buildEmbedUrl({
      providerKind: "none",
      conversationRef: "fixture-conv:whatever",
    });
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.code).toBe("PROVIDER_KIND_HAS_NO_EMBED");
  });

  it("buildEmbedUrl refuses an invalid opaque ref before checking activation", () => {
    const result = buildEmbedUrl({
      providerKind: "fixture",
      conversationRef: "https://pol.is/xid-123?token=secret",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_CONVERSATION_REF");
  });

  it("buildEmbedUrl fails closed on the activation gate even with fully valid inputs", () => {
    const result = buildEmbedUrl({
      providerKind: "fixture",
      conversationRef: "fixture-conv:topic-alpha-billing",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EMBED_ACTIVATION_GATES_UNRESOLVED");
    }
  });

  it("never returns ok:true for any input while activation gates are unresolved", () => {
    const attempts = [
      { providerKind: "fixture" as const, conversationRef: "fixture-conv:a" },
      { providerKind: "fixture" as const, conversationRef: "fixture-conv:b" },
      { providerKind: "none" as const, conversationRef: "fixture-conv:c" },
    ];
    for (const attempt of attempts) {
      expect(buildEmbedUrl(attempt).ok).toBe(false);
    }
  });

  it("validateProposedEmbedOrigin uses the exact allowlist, not a suffix match", () => {
    expect(validateProposedEmbedOrigin(FIXTURE_EMBED_ORIGIN).ok).toBe(true);
    expect(validateProposedEmbedOrigin("https://evilpol.is").ok).toBe(false);
    expect(validateProposedEmbedOrigin("https://pol.is.evil.example").ok).toBe(
      false,
    );
    expect(
      validateProposedEmbedOrigin("https://pol.is/?access_token=x").ok,
    ).toBe(false);
  });
});
