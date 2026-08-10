import type { AdapterResult } from "@/lib/adapters/types";

/**
 * Verification artifact handling (package 2.7).
 * Prefer status-only storage; raw artifacts short-lived or never stored.
 */
export type VerificationAssertionKind =
  | "bot_resistance"
  | "contact_continuity"
  | "uniqueness"
  | "eligibility"
  | "residency"
  | "legal_identity";

export type VerificationCaseStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "appealed"
  | "revoked";

export interface VerificationAdapter {
  readonly name: "verification";
  getStatus(
    accountId: string,
    kind: VerificationAssertionKind,
  ): Promise<AdapterResult<VerificationCaseStatus | "none">>;
}

export class StubVerificationAdapter implements VerificationAdapter {
  readonly name = "verification" as const;

  async getStatus(
    _accountId: string,
    _kind: VerificationAssertionKind,
  ): Promise<AdapterResult<VerificationCaseStatus | "none">> {
    return { ok: true, value: "none" };
  }
}
