import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  persons,
  roleAssignments,
  verificationArtifactHolds,
  verificationCases,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { newEntityId } from "@/lib/auth/tokens";
import {
  CAPABILITY_ASSURANCE,
  toPublicConsultationSafeProjection,
} from "@/lib/verification/ladder";
import {
  appealCase,
  approveCase,
  assignReviewer,
  denyCase,
  expireDueCases,
  openVerificationCase,
  purgeExpiredArtifactHolds,
  revokeCase,
} from "@/lib/verification/cases";
import {
  evaluateAssurance,
  getKindStatus,
  listAccountVerificationStatus,
} from "@/lib/verification/status";

const SUBJECT = "account-ostt-synth-verify-subject";
const REVIEWER = "account-ostt-synth-verify-reviewer";
const INTRUDER = "account-ostt-synth-verify-intruder";

async function insertActive(
  db: Awaited<ReturnType<typeof createTestDatabase>>["db"],
  id: string,
  roles: Array<"participant" | "reviewer" | "administrator">,
) {
  const personId = newEntityId("person");
  await db.insert(persons).values({
    id: personId,
    synthetic: true,
    displayLabel: `ostt-synth ${id}`,
  });
  await db.insert(accounts).values({
    id,
    personId,
    contactChannel: `${id}@ostt.synth.test`,
    lifecycleState: "active",
    synthetic: true,
    contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    activatedAt: new Date("2026-08-02T00:00:00.000Z"),
  });
  for (const role of roles) {
    await db.insert(roleAssignments).values({
      id: newEntityId("role"),
      accountId: id,
      role,
      grantedByLabel: "ostt-synth-verify-test",
      reason: "Verification ladder fixture.",
    });
  }
}

describe("verification ladder (2.7)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];

  beforeAll(async () => {
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
    await insertActive(db, SUBJECT, ["participant"]);
    await insertActive(db, REVIEWER, ["reviewer"]);
    await insertActive(db, INTRUDER, ["participant"]);
  }, 120_000);

  afterAll(async () => {
    await client.close();
  });

  it("maps higher-impact capabilities to higher assurance without requiring legal_identity for voting", () => {
    expect(CAPABILITY_ASSURANCE["institutional.vote"]).toBe("L3_uniqueness");
    expect(CAPABILITY_ASSURANCE["institutional.council_policy"]).toBe(
      "L4_eligibility",
    );
    expect(CAPABILITY_ASSURANCE["institutional.vote"]).not.toBe(
      "L6_legal_identity",
    );
  });

  it("keeps verification fields out of public consultation projections", () => {
    const safe = toPublicConsultationSafeProjection({
      statementId: "s1",
      text: "synthetic statement",
      verification: { status: "approved" },
      verificationStatus: "approved",
      verificationArtifacts: ["secret"],
      assuranceLevel: "L6_legal_identity",
      evidencePointer: "pointer",
      vote: "agree",
    });
    expect(safe).toEqual({ statementId: "s1", text: "synthetic statement", vote: "agree" });
    expect("verification" in safe).toBe(false);
    expect("evidencePointer" in safe).toBe(false);
  });

  it("opens distinct assertion kinds, rejects conflicts, and blocks unauthorized reviewers", async () => {
    const opened = await openVerificationCase(db, {
      accountId: SUBJECT,
      kind: "uniqueness",
      assertionSummary: "Synthetic uniqueness attestation (no raw artifact).",
      actorAccountId: SUBJECT,
      holdPurpose: "short-lived uniqueness review hold",
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const conflict = await openVerificationCase(db, {
      accountId: SUBJECT,
      kind: "uniqueness",
      assertionSummary: "Conflicting second uniqueness case.",
      actorAccountId: SUBJECT,
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.code).toBe("VERIFY_CONFLICTING_CASE");
    }

    const unauthorized = await assignReviewer(db, {
      caseId: opened.value.caseId,
      reviewerAccountId: REVIEWER,
      actorAccountId: INTRUDER,
    });
    expect(unauthorized.ok).toBe(false);

    const selfReview = await assignReviewer(db, {
      caseId: opened.value.caseId,
      reviewerAccountId: SUBJECT,
      actorAccountId: REVIEWER,
    });
    expect(selfReview.ok).toBe(false);
    if (!selfReview.ok) {
      expect(selfReview.code).toBe("VERIFY_SELF_REVIEW");
    }

    const assigned = await assignReviewer(db, {
      caseId: opened.value.caseId,
      reviewerAccountId: REVIEWER,
      actorAccountId: REVIEWER,
    });
    expect(assigned.ok).toBe(true);

    const deniedNoReason = await denyCase(db, {
      caseId: opened.value.caseId,
      actorAccountId: REVIEWER,
      reason: "   ",
    });
    expect(deniedNoReason.ok).toBe(false);

    const approved = await approveCase(db, {
      caseId: opened.value.caseId,
      actorAccountId: REVIEWER,
      reason: "Synthetic uniqueness approved for ladder tests.",
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(approved.ok).toBe(true);
    expect(await getKindStatus(db, SUBJECT, "uniqueness")).toBe("approved");
  });

  it("expires, revokes, and appeals with structured reasons", async () => {
    const opened = await openVerificationCase(db, {
      accountId: SUBJECT,
      kind: "eligibility",
      assertionSummary: "Synthetic eligibility assertion summary.",
      actorAccountId: SUBJECT,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    await assignReviewer(db, {
      caseId: opened.value.caseId,
      reviewerAccountId: REVIEWER,
      actorAccountId: REVIEWER,
    });

    const past = new Date(Date.now() - 1_000);
    await approveCase(db, {
      caseId: opened.value.caseId,
      actorAccountId: REVIEWER,
      reason: "Temporary approval for expiration test.",
      expiresAt: past,
    });

    const expiredCount = await expireDueCases(db, new Date());
    expect(expiredCount).toBeGreaterThanOrEqual(1);
    expect(await getKindStatus(db, SUBJECT, "eligibility")).toBe("expired");

    const reopened = await openVerificationCase(db, {
      accountId: SUBJECT,
      kind: "eligibility",
      assertionSummary: "Re-opened after expiry.",
      actorAccountId: SUBJECT,
    });
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) {
      return;
    }

    await approveCase(db, {
      caseId: reopened.value.caseId,
      actorAccountId: REVIEWER,
      reason: "Approved again for revocation test.",
    });

    const revoked = await revokeCase(db, {
      caseId: reopened.value.caseId,
      actorAccountId: REVIEWER,
      reason: "Revoked because synthetic fixture conflict resolved.",
    });
    expect(revoked.ok).toBe(true);
    expect(await getKindStatus(db, SUBJECT, "eligibility")).toBe("revoked");

    const appealed = await appealCase(db, {
      caseId: reopened.value.caseId,
      accountId: SUBJECT,
      reason: "Requesting re-review after revocation.",
    });
    expect(appealed.ok).toBe(true);
    expect(await getKindStatus(db, SUBJECT, "eligibility")).toBe("appealed");
  });

  it("evaluates assurance gaps and purges expired artifact holds", async () => {
    const vote = await evaluateAssurance(db, SUBJECT, "institutional.vote");
    expect(vote.requiredLevel).toBe("L3_uniqueness");
    // uniqueness approved earlier; bot_resistance + contact_continuity still missing
    expect(vote.ok).toBe(false);
    expect(vote.missingKinds).toContain("bot_resistance");
    expect(vote.missingKinds).toContain("contact_continuity");

    const statuses = await listAccountVerificationStatus(db, SUBJECT);
    expect(statuses.every((row) => !("evidencePointer" in row))).toBe(true);

    const holds = await db.select().from(verificationArtifactHolds);
    if (holds.length > 0) {
      await db
        .update(verificationArtifactHolds)
        .set({ expiresAt: new Date(Date.now() - 5_000) })
        .where(eq(verificationArtifactHolds.id, holds[0]!.id));
      const purged = await purgeExpiredArtifactHolds(db);
      expect(purged).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejects self-review at the database layer", async () => {
    await expect(
      db.insert(verificationCases).values({
        id: newEntityId("vcase"),
        accountId: SUBJECT,
        kind: "residency",
        status: "pending",
        reviewerAccountId: SUBJECT,
        synthetic: true,
      }),
    ).rejects.toThrow();
  });
});
