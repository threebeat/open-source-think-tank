import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  auditEvents,
  claimReviews,
  claims,
  evidenceReviews,
  evidenceSubmissions,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { isRegisteredAuditAction } from "@/lib/audit/registry";
import { reviewClaim } from "@/lib/claims/review";
import {
  decideEvidenceQuality,
  reviewEvidenceWorkflow,
} from "@/lib/evidence/review";
import {
  createAndSubmitClaimEvidence,
} from "@/lib/submissions/submit";
import { createTopic, transitionTopic } from "@/lib/topics/authoring";
import { seedApprovedAssertions } from "@/lib/verification/seed-assurance";

const ADMIN = "account-ostt-synth-staff-admin";
const PARTICIPANT = "account-ostt-synth-ada";

describe("claim and evidence review (3.6)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previousMode: string | undefined;
  let previousDbUrl: string | undefined;
  let openTopicId: string;

  beforeAll(async () => {
    previousMode = process.env.APP_MODE;
    previousDbUrl = process.env.DATABASE_URL;
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_review";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);

    await seedApprovedAssertions(db, PARTICIPANT, [
      "bot_resistance",
      "uniqueness",
    ]);
    await db
      .update(accounts)
      .set({
        lifecycleState: "active",
        activatedAt: new Date("2026-08-02T00:00:00.000Z"),
      })
      .where(eq(accounts.id, PARTICIPANT));

    const topic = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "review-open-topic",
      title: "Review open topic",
      question: "What should change?",
      background: "Background text for review tests.",
      scope: "Scope text for review tests.",
      jurisdictionLevel: "statewide",
      countyFips: null,
    });
    expect(topic.ok).toBe(true);
    if (!topic.ok) throw new Error("topic create failed");
    openTopicId = topic.value.id;
    const opened = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: openTopicId,
      action: "open",
      expectedWorkflowState: "draft",
    });
    expect(opened.ok).toBe(true);
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
    if (previousDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDbUrl;
  });

  async function submitBundle(suffix: string) {
    const result = await createAndSubmitClaimEvidence(db, {
      actorAccountId: PARTICIPANT,
      topicId: openTopicId,
      claimTitle: `Claim ${suffix}`,
      claimSummary: `Summary for ${suffix}`,
      approachLabel: "Approach",
      sourceUrl: `https://example.ostt.synth.test/${suffix}`,
      evidenceTitle: `Evidence ${suffix}`,
      organization: "Desk",
      authorType: "agency",
      sourceType: "memo",
      limitations: "Synthetic limitations language for review.",
      relationship: "supporting",
      disclosureChoice: "none",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("submit failed");
    return result.value;
  }

  it("registers review audit actions", () => {
    for (const action of [
      "claims.changes_requested",
      "claims.accepted",
      "claims.rejected",
      "evidence.changes_requested",
      "evidence.accepted",
      "evidence.rejected",
      "evidence.quality_decided",
      "topics.published",
    ]) {
      expect(isRegisteredAuditAction(action)).toBe(true);
    }
  });

  it("denies participant claim review", async () => {
    const bundle = await submitBundle("deny-participant");
    const denied = await reviewClaim(db, {
      actorAccountId: PARTICIPANT,
      claimId: bundle.claim.id,
      decision: "accepted",
      publicRationale: "Should not work for participants.",
      expectedWorkflowState: "submitted",
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("expected deny");
    expect(denied.code).toMatch(/AUTHZ|DENIED|ASSURANCE|ACTIVE/);
  });

  it("admin fallback can accept a submitted claim with public rationale", async () => {
    const bundle = await submitBundle("claim-accept");
    const result = await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "accepted",
      publicRationale: "Claim is coherent and limitations are clear.",
      privateNotes: "Staff-only note must stay private.",
      expectedWorkflowState: "submitted",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("accept failed");
    expect(result.value.claim.workflowState).toBe("accepted");

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "claims.accepted"))
      .limit(1);
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit)).not.toContain("Staff-only note");
    expect(JSON.stringify(audit)).not.toContain("Claim is coherent");
  });

  it("rejects blank rationale and leaves no review/audit/state change", async () => {
    const bundle = await submitBundle("blank-rationale");
    const beforeReviews = await db.select().from(claimReviews);
    const beforeAudits = await db.select().from(auditEvents);
    const result = await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "rejected",
      publicRationale: "short",
      expectedWorkflowState: "submitted",
    });
    expect(result.ok).toBe(false);
    const afterReviews = await db.select().from(claimReviews);
    const afterAudits = await db.select().from(auditEvents);
    expect(afterReviews.length).toBe(beforeReviews.length);
    expect(afterAudits.length).toBe(beforeAudits.length);
    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, bundle.claim.id));
    expect(claim?.workflowState).toBe("submitted");
  });

  it("stale concurrent claim review loses cleanly", async () => {
    const bundle = await submitBundle("stale-claim");
    const first = await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "changes_requested",
      publicRationale: "Please clarify the approach label.",
      expectedWorkflowState: "submitted",
    });
    expect(first.ok).toBe(true);
    const second = await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "accepted",
      publicRationale: "Second decision should be rejected as stale.",
      expectedWorkflowState: "submitted",
    });
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("expected stale");
    expect(second.code).toMatch(/SOURCE_STATE|STATE_CONFLICT/);
  });

  it("evidence workflow does not change quality; quality does not change workflow", async () => {
    const bundle = await submitBundle("evidence-axes");
    const workflow = await reviewEvidenceWorkflow(db, {
      actorAccountId: ADMIN,
      evidenceSubmissionId: bundle.evidence.id,
      decision: "accepted",
      publicRationale: "Evidence workflow accepted for process drill.",
      expectedWorkflowState: "submitted",
    });
    expect(workflow.ok).toBe(true);
    if (!workflow.ok) throw new Error("workflow failed");
    expect(workflow.value.evidence.workflowState).toBe("accepted");
    expect(workflow.value.evidence.qualityStatus).toBe("pending");

    const quality = await decideEvidenceQuality(db, {
      actorAccountId: ADMIN,
      evidenceSubmissionId: bundle.evidence.id,
      qualityStatus: "limited",
      publicRationale: "Useful source with clear limitations language.",
      expectedQualityStatus: "pending",
    });
    expect(quality.ok).toBe(true);
    if (!quality.ok) throw new Error("quality failed");
    expect(quality.value.evidence.qualityStatus).toBe("limited");
    expect(quality.value.evidence.workflowState).toBe("accepted");

    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, bundle.claim.id));
    expect(claim?.workflowState).toBe("submitted");
  });

  it("quality_decided rejects pending as a choice", async () => {
    const bundle = await submitBundle("quality-pending");
    const result = await decideEvidenceQuality(db, {
      actorAccountId: ADMIN,
      evidenceSubmissionId: bundle.evidence.id,
      // @ts-expect-error pending is not a reviewer choice
      qualityStatus: "pending",
      publicRationale: "Should not accept pending as a quality decision.",
      expectedQualityStatus: "pending",
    });
    expect(result.ok).toBe(false);
  });

  it("append-only claim review triggers reject UPDATE and DELETE", async () => {
    const bundle = await submitBundle("append-only");
    const reviewed = await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "accepted",
      publicRationale: "Accepted for append-only trigger coverage.",
      expectedWorkflowState: "submitted",
    });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) throw new Error("review failed");

    await expect(
      db
        .update(claimReviews)
        .set({ publicRationale: "tamper" })
        .where(eq(claimReviews.id, reviewed.value.review.id)),
    ).rejects.toThrow();

    await expect(
      db
        .delete(claimReviews)
        .where(eq(claimReviews.id, reviewed.value.review.id)),
    ).rejects.toThrow();
  });

  it("audit failure rolls back claim review and state", async () => {
    const bundle = await submitBundle("audit-rollback");
    const auditModule = await import("@/lib/auth/audit-log");
    const spy = vi
      .spyOn(auditModule, "appendAuthAudit")
      .mockRejectedValue(new Error("forced audit failure"));

    const result = await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "rejected",
      publicRationale: "This should roll back on audit failure.",
      expectedWorkflowState: "submitted",
    });
    spy.mockRestore();
    expect(result.ok).toBe(false);

    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, bundle.claim.id));
    expect(claim?.workflowState).toBe("submitted");
    const reviews = await db
      .select()
      .from(claimReviews)
      .where(eq(claimReviews.claimId, bundle.claim.id));
    expect(reviews).toHaveLength(0);
  });

  it("evidence append-only triggers reject UPDATE", async () => {
    const bundle = await submitBundle("evidence-append");
    const reviewed = await reviewEvidenceWorkflow(db, {
      actorAccountId: ADMIN,
      evidenceSubmissionId: bundle.evidence.id,
      decision: "changes_requested",
      publicRationale: "Please strengthen limitations language.",
      expectedWorkflowState: "submitted",
    });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) throw new Error("review failed");
    await expect(
      db
        .update(evidenceReviews)
        .set({ publicRationale: "tamper" })
        .where(eq(evidenceReviews.id, reviewed.value.review.id)),
    ).rejects.toThrow();
    const [evidence] = await db
      .select()
      .from(evidenceSubmissions)
      .where(eq(evidenceSubmissions.id, bundle.evidence.id));
    expect(evidence?.qualityStatus).toBe("pending");
  });
});
