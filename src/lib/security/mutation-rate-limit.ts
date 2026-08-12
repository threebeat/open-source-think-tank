import {
  operationalSubjectRef,
  securityLog,
} from "@/lib/security/log";

/**
 * Domain-neutral mutation rate limiter.
 *
 * This package ships a pruned in-process sliding-window implementation suitable
 * for single-instance alpha. A shared implementation is required before a
 * multi-instance gated deployment (OQ14 / architecture D13).
 */

export type MutationRateLimitFamily =
  | "create_submission"
  | "edit_resubmit_withdraw_disclosure"
  | "claim_evidence_review_quality"
  | "moderation_action"
  /** Account-holder privacy mutations (closure/deletion requests). Single-instance alpha only (OQ14). */
  | "privacy_request";

export type MutationRateLimitPolicy = {
  accountLimit: number;
  originLimit: number;
  windowMs: number;
};

/** Initial alpha policy constants — keep in one module with tests. */
export const MUTATION_RATE_LIMIT_POLICY: Record<
  MutationRateLimitFamily,
  MutationRateLimitPolicy
> = {
  create_submission: {
    accountLimit: 8,
    originLimit: 24,
    windowMs: 15 * 60 * 1000,
  },
  edit_resubmit_withdraw_disclosure: {
    accountLimit: 30,
    originLimit: 90,
    windowMs: 15 * 60 * 1000,
  },
  claim_evidence_review_quality: {
    accountLimit: 60,
    originLimit: 180,
    windowMs: 15 * 60 * 1000,
  },
  moderation_action: {
    accountLimit: 30,
    originLimit: 90,
    windowMs: 15 * 60 * 1000,
  },
  // Closure requests are rare; keep a tight privacy-specific bucket rather than
  // borrowing submission/moderation limits. In-process only (OQ14).
  privacy_request: {
    accountLimit: 5,
    originLimit: 15,
    windowMs: 15 * 60 * 1000,
  },
};

export type MutationRateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; bucket: "account" | "origin" };

export type MutationRateLimiter = {
  consume(input: {
    family: MutationRateLimitFamily;
    accountId: string;
    originRef?: string | null;
    now?: number;
  }): MutationRateLimitResult;
  reset(): void;
};

type Bucket = { count: number; resetAt: number; loggedDenial: boolean };

function createInProcessMutationRateLimiter(): MutationRateLimiter {
  const buckets = new Map<string, Bucket>();

  function prune(now: number) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  function consumeBucket(
    key: string,
    limit: number,
    windowMs: number,
    now: number,
  ): MutationRateLimitResult & { key: string } {
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs, loggedDenial: false });
      return { ok: true, key };
    }
    if (existing.count >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      );
      return { ok: false, retryAfterSeconds, bucket: "account", key };
    }
    existing.count += 1;
    return { ok: true, key };
  }

  return {
    consume(input) {
      const policy = MUTATION_RATE_LIMIT_POLICY[input.family];
      const now = input.now ?? Date.now();
      prune(now);

      const accountKey = `mut:${input.family}:acct:${operationalSubjectRef(input.accountId)}`;
      const accountResult = consumeBucket(
        accountKey,
        policy.accountLimit,
        policy.windowMs,
        now,
      );
      if (!accountResult.ok) {
        const bucket = buckets.get(accountKey);
        if (bucket && !bucket.loggedDenial) {
          bucket.loggedDenial = true;
          securityLog({
            level: "warn",
            event: "mutation.rate_limited",
            subjectRef: operationalSubjectRef(input.accountId),
            details: {
              family: input.family,
              bucket: "account",
              limit: policy.accountLimit,
              retryAfterSeconds: accountResult.retryAfterSeconds,
            },
          });
        }
        return {
          ok: false,
          retryAfterSeconds: accountResult.retryAfterSeconds,
          bucket: "account",
        };
      }

      if (input.originRef) {
        const originKey = `mut:${input.family}:orig:${input.originRef}`;
        const originHit = buckets.get(originKey);
        if (originHit && originHit.resetAt > now && originHit.count >= policy.originLimit) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((originHit.resetAt - now) / 1000),
          );
          if (!originHit.loggedDenial) {
            originHit.loggedDenial = true;
            securityLog({
              level: "warn",
              event: "mutation.rate_limited",
              subjectRef: operationalSubjectRef(input.accountId),
              details: {
                family: input.family,
                bucket: "origin",
                limit: policy.originLimit,
                retryAfterSeconds,
                originRef: input.originRef,
              },
            });
          }
          // Refund the account bucket count for a pure origin denial so the
          // account window is not consumed by origin pressure alone.
          const acct = buckets.get(accountKey);
          if (acct && acct.count > 0) acct.count -= 1;
          return { ok: false, retryAfterSeconds, bucket: "origin" };
        }
        if (!originHit || originHit.resetAt <= now) {
          buckets.set(originKey, {
            count: 1,
            resetAt: now + policy.windowMs,
            loggedDenial: false,
          });
        } else {
          originHit.count += 1;
        }
      }

      return { ok: true };
    },
    reset() {
      buckets.clear();
    },
  };
}

let sharedLimiter: MutationRateLimiter = createInProcessMutationRateLimiter();

export function getMutationRateLimiter(): MutationRateLimiter {
  return sharedLimiter;
}

/** Test helper — replace or reset the process-local limiter. */
export function resetMutationRateLimiter(): void {
  sharedLimiter.reset();
}

export function setMutationRateLimiterForTests(
  limiter: MutationRateLimiter,
): void {
  sharedLimiter = limiter;
}

export function createFreshMutationRateLimiterForTests(): MutationRateLimiter {
  return createInProcessMutationRateLimiter();
}
