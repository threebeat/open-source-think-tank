import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MUTATION_RATE_LIMIT_POLICY,
  createFreshMutationRateLimiterForTests,
  resetMutationRateLimiter,
} from "@/lib/security/mutation-rate-limit";

describe("mutation rate limiter (3.9)", () => {
  afterEach(() => {
    resetMutationRateLimiter();
    vi.restoreAllMocks();
  });

  it("keeps alpha policy constants in one module", () => {
    expect(MUTATION_RATE_LIMIT_POLICY.create_submission).toEqual({
      accountLimit: 8,
      originLimit: 24,
      windowMs: 15 * 60 * 1000,
    });
    expect(MUTATION_RATE_LIMIT_POLICY.edit_resubmit_withdraw_disclosure).toEqual(
      {
        accountLimit: 30,
        originLimit: 90,
        windowMs: 15 * 60 * 1000,
      },
    );
    expect(MUTATION_RATE_LIMIT_POLICY.claim_evidence_review_quality).toEqual({
      accountLimit: 60,
      originLimit: 180,
      windowMs: 15 * 60 * 1000,
    });
    expect(MUTATION_RATE_LIMIT_POLICY.moderation_action).toEqual({
      accountLimit: 30,
      originLimit: 90,
      windowMs: 15 * 60 * 1000,
    });
    expect(MUTATION_RATE_LIMIT_POLICY.privacy_request).toEqual({
      accountLimit: 5,
      originLimit: 15,
      windowMs: 15 * 60 * 1000,
    });
    expect(MUTATION_RATE_LIMIT_POLICY.consultation_lifecycle).toEqual({
      accountLimit: 30,
      originLimit: 90,
      windowMs: 15 * 60 * 1000,
    });
    expect(MUTATION_RATE_LIMIT_POLICY.consultation_reports).toEqual({
      accountLimit: 30,
      originLimit: 90,
      windowMs: 15 * 60 * 1000,
    });
    expect(MUTATION_RATE_LIMIT_POLICY.commons_post).toEqual({
      accountLimit: 8,
      originLimit: 24,
      windowMs: 15 * 60 * 1000,
    });
  });

  it("isolates limits by family and account", () => {
    const limiter = createFreshMutationRateLimiterForTests();
    const now = 1_000_000;
    for (let i = 0; i < 8; i += 1) {
      expect(
        limiter.consume({
          family: "create_submission",
          accountId: "account-a",
          now,
        }).ok,
      ).toBe(true);
    }
    const denied = limiter.consume({
      family: "create_submission",
      accountId: "account-a",
      now,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(denied.retryAfterSeconds)).toBe(true);
    }
    expect(
      limiter.consume({
        family: "moderation_action",
        accountId: "account-a",
        now,
      }).ok,
    ).toBe(true);
    expect(
      limiter.consume({
        family: "create_submission",
        accountId: "account-b",
        now,
      }).ok,
    ).toBe(true);
  });

  it("adds an origin bucket when an origin ref is provided", () => {
    const limiter = createFreshMutationRateLimiterForTests();
    const now = 2_000_000;
    for (let i = 0; i < 24; i += 1) {
      expect(
        limiter.consume({
          family: "create_submission",
          accountId: `account-${i}`,
          originRef: "orig_shared",
          now,
        }).ok,
      ).toBe(true);
    }
    const denied = limiter.consume({
      family: "create_submission",
      accountId: "account-new",
      originRef: "orig_shared",
      now,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.bucket).toBe("origin");
  });

  it("prunes expired buckets and rounds Retry-After up", () => {
    const limiter = createFreshMutationRateLimiterForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const now = 3_000_000;
    for (let i = 0; i < 8; i += 1) {
      limiter.consume({
        family: "create_submission",
        accountId: "account-a",
        now,
      });
    }
    const denied = limiter.consume({
      family: "create_submission",
      accountId: "account-a",
      now: now + 1,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.retryAfterSeconds).toBe(
        Math.ceil((15 * 60 * 1000 - 1) / 1000),
      );
    }
    expect(
      limiter.consume({
        family: "create_submission",
        accountId: "account-a",
        now: now + 15 * 60 * 1000 + 1,
      }).ok,
    ).toBe(true);
    expect(warn).toHaveBeenCalled();
    const logged = String(warn.mock.calls[0]?.[0] ?? "");
    expect(logged).toContain("mutation.rate_limited");
    expect(logged).not.toContain("account-a");
  });
});
