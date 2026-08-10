import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  persons,
  roleAssignments,
  verificationAssertions,
  verificationCases,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { newEntityId } from "@/lib/auth/tokens";
import {
  CAPABILITY_ASSURANCE,
  toPublicConsultationSafeProjection,
} from "@/lib/verification/ladder";
import {
  resolveArtifactAccess,
} from "@/lib/verification/artifacts";
import {
  appealCase,
  approveCase,
  assignReviewer,
  expireDueCases,
  openVerificationCase,
  purgeExpiredArtifactHolds,
  reassignReviewer,
  revokeCase,
} from "@/lib/verification/cases";
import {
  getKindStatus,
  listAccountVerificationStatus,
} from "@/lib/verification/status";
import {
  L2_KINDS,
  seedApprovedAssertions,
} from "@/lib/verification/seed-assurance";

const SUBJECT = "account-ostt-synth-verify-subject";
const REVIEWER = "account-ostt-synth-verify-reviewer";
const REVIEWER_B = "account-ostt-synth-verify-reviewer-b";
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
    await insertActive(db, REVIEWER_B, ["reviewer"]);
    await insertActive(db, INTRUDER, ["participant"]);
    await seedApprovedAssertions(db, REVIEWER, L2_KINDS);
    await seedApprovedAssertions(db, REVIEWER_B, L2_KINDS);
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
    expect(safe).toEqual({
      statementId: "s1",
      text: "synthetic statement",
      vote: "agree",
    });
  });

  it("rejects client pointers/URLs and purges artifact access after expiry", async () => {
    const badPointer = await openVerificationCase(db, {
      accountId: SUBJECT,
      kind: "residency",
      assertionSummary: "Synthetic residency summary.",
      actorAccountId: SUBJECT,
      evidencePointer: "https://evil.example/doc.pdf",
    });
    expect(badPointer.ok).toBe(false);
    if (!badPointer.ok) {
      expect(badPointer.code).toBe("VERIFY_POINTER_FORBIDDEN");
    }

    const badSummary = await openVerificationCase(db, {
      accountId: SUBJECT,
      kind: "residency",
      assertionSummary: "See https://evil.example/secret",
      actorAccountId: SUBJECT,
    });
    expect(badSummary.ok).toBe(false);

    const opened = await openVerificationCase(db, {
      accountId: SUBJECT,
      kind: "residency",
      assertionSummary: "Synthetic residency assertion summary.",
      actorAccountId: SUBJECT,
      artifact: {
        purpose: "short-lived residency review hold",
        sensitivePayload: "SYNTHETIC-SENSITIVE-ARTIFACT",
        ttlMs: 1,
      },
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }
    expect(opened.value.evidencePointer).toMatch(/^ostt:vhold:/);

    await new Promise((r) => setTimeout(r, 5));
    const purged = await purgeExpiredArtifactHolds(db, new Date());
    expect(purged).toBeGreaterThanOrEqual(1);

    const access = await resolveArtifactAccess(
      db,
      opened.value.evidencePointer!,
    );
    expect(access.ok).toBe(false);

    const [assertion] = await db
      .select()
      .from(verificationAssertions)
      .where(eq(verificationAssertions.id, opened.value.assertionId));
    expect(assertion?.evidencePointer).toMatch(/^ostt:purged:/);
  });

  it("assigns/decides transactionally and rejects concurrent non-assignee decisions", async () => {
    const opened = await openVerificationCase(db, {
      accountId: SUBJECT,
      kind: "uniqueness",
      assertionSummary: "Synthetic uniqueness attestation (no raw artifact).",
      actorAccountId: SUBJECT,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
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

    const assigned = await assignReviewer(db, {
      caseId: opened.value.caseId,
      reviewerAccountId: REVIEWER,
      actorAccountId: REVIEWER,
    });
    expect(assigned.ok).toBe(true);

    const secondAssign = await assignReviewer(db, {
      caseId: opened.value.caseId,
      reviewerAccountId: REVIEWER_B,
      actorAccountId: REVIEWER_B,
    });
    expect(secondAssign.ok).toBe(false);

    const otherDecides = await approveCase(db, {
      caseId: opened.value.caseId,
      actorAccountId: REVIEWER_B,
      reason: "Not the assigned reviewer.",
    });
    expect(otherDecides.ok).toBe(false);
    if (!otherDecides.ok) {
      expect(otherDecides.code).toBe("VERIFY_DECISION_CONFLICT");
    }

    const reassigned = await reassignReviewer(db, {
      caseId: opened.value.caseId,
      reviewerAccountId: REVIEWER_B,
      actorAccountId: REVIEWER,
      reason: "Explicit reassignment for concurrency coverage.",
    });
    expect(reassigned.ok).toBe(true);

    const approved = await approveCase(db, {
      caseId: opened.value.caseId,
      actorAccountId: REVIEWER_B,
      reason: "Synthetic uniqueness approved for ladder tests.",
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(approved.ok).toBe(true);

    const [row] = await db
      .select()
      .from(verificationCases)
      .where(eq(verificationCases.id, opened.value.caseId));
    expect(row?.reviewerAccountId).toBe(REVIEWER_B);
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

    await assignReviewer(db, {
      caseId: reopened.value.caseId,
      reviewerAccountId: REVIEWER,
      actorAccountId: REVIEWER,
    });
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

  it("lists status without evidence pointers", async () => {
    const statuses = await listAccountVerificationStatus(db, SUBJECT);
    expect(statuses.every((row) => !("evidencePointer" in row))).toBe(true);
  });

  it("rejects self-review at the database layer", async () => {
    await expect(
      db.insert(verificationCases).values({
        id: newEntityId("vcase"),
        accountId: SUBJECT,
        kind: "legal_identity",
        status: "pending",
        reviewerAccountId: SUBJECT,
        synthetic: true,
      }),
    ).rejects.toThrow();
  });
});
