import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as auditModule from "@/lib/auth/audit-log";
import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  auditEvents,
  claims,
  contentRevisions,
  evidenceSubmissions,
  moderationActions,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { isRegisteredAuditAction } from "@/lib/audit/registry";
import { reviewClaim } from "@/lib/claims/review";
import * as moderationRepository from "@/lib/moderation/repository";
import { toPublicModerationNotice } from "@/lib/moderation/schemas";
import { moderateClaim, moderateEvidence } from "@/lib/moderation/service";
import {
  createAndSubmitClaimEvidence,
  updateOwnClaimContent,
} from "@/lib/submissions/submit";
import { createTopic, transitionTopic } from "@/lib/topics/authoring";
import { seedApprovedAssertions } from "@/lib/verification/seed-assurance";

const ADMIN = "account-ostt-synth-staff-admin";
const MODERATOR = "account-ostt-synth-staff-moderator";
const PARTICIPANT = "account-ostt-synth-ada";

describe("moderation visibility actions (3.8)", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_moderation";

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
      slug: "moderation-open-topic",
      title: "Open for moderation tests",
      question: "What should change?",
      background: "Background",
      scope: "Scope",
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
    await client.close();
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
      claimSummary: `Summary ${suffix}`,
      approachLabel: `Approach ${suffix}`,
      sourceUrl: `https://example.org/${suffix}`,
      evidenceTitle: `Evidence ${suffix}`,
      organization: `Org ${suffix}`,
      authorType: "agency",
      sourceType: "memo",
      limitations: `Limitations ${suffix}`,
      relationship: "supporting",
      disclosureChoice: "none",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("submit failed");
    return result.value;
  }

  async function getClaimRow(claimId: string) {
    const [row] = await db.select().from(claims).where(eq(claims.id, claimId));
    if (!row) throw new Error("claim missing");
    return row;
  }

  async function getEvidenceRow(evidenceId: string) {
    const [row] = await db
      .select()
      .from(evidenceSubmissions)
      .where(eq(evidenceSubmissions.id, evidenceId));
    if (!row) throw new Error("evidence missing");
    return row;
  }

  it("registers moderation audit actions", () => {
    expect(isRegisteredAuditAction("moderation.submission_held")).toBe(true);
    expect(isRegisteredAuditAction("moderation.submission_hidden")).toBe(true);
    expect(isRegisteredAuditAction("moderation.submission_restored")).toBe(
      true,
    );
  });

  it("enforces exactly-one-subject for moderation_actions", async () => {
    const bundle = await submitBundle("subject-constraint");

    await expect(
      db.execute(sql`
        INSERT INTO moderation_actions (
          id, topic_id, claim_id, evidence_submission_id, actor_account_id,
          action, from_visibility, to_visibility, public_rationale, synthetic
        ) VALUES (
          'modact_both_subjects', ${openTopicId}, ${bundle.claim.id}, ${bundle.evidence.id},
          ${ADMIN}, 'hold', 'visible', 'held',
          'Both subjects must fail.', true
        )
      `),
    ).rejects.toThrow();

    await expect(
      db.execute(sql`
        INSERT INTO moderation_actions (
          id, topic_id, claim_id, evidence_submission_id, actor_account_id,
          action, from_visibility, to_visibility, public_rationale, synthetic
        ) VALUES (
          'modact_neither_subject', ${openTopicId}, NULL, NULL,
          ${ADMIN}, 'hold', 'visible', 'held',
          'Neither subject must fail.', true
        )
      `),
    ).rejects.toThrow();
  });

  it("makes moderation_actions immutable under UPDATE/DELETE", async () => {
    const bundle = await submitBundle("immutable");
    const claim = await getClaimRow(bundle.claim.id);
    const held = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "Hold for immutability coverage.",
      expectedVisibility: "visible",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(held.ok).toBe(true);
    if (!held.ok) return;

    await expect(
      db
        .update(moderationActions)
        .set({ publicRationale: "overwrite" })
        .where(eq(moderationActions.id, held.value.action.id)),
    ).rejects.toThrow(/immutable|Failed query/i);

    await expect(
      db
        .delete(moderationActions)
        .where(eq(moderationActions.id, held.value.action.id)),
    ).rejects.toThrow(/immutable|Failed query/i);
  });

  it("allows hold/hide/restore transitions and never stores restored", async () => {
    const bundle = await submitBundle("transitions");
    let claim = await getClaimRow(bundle.claim.id);

    const held = await moderateClaim(db, {
      actorAccountId: MODERATOR,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "Holding for transition coverage.",
      expectedVisibility: "visible",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(held.ok).toBe(true);
    if (!held.ok) return;
    expect(held.value.claim.moderationVisibility).toBe("held");
    expect(held.value.action.toVisibility).toBe("held");

    claim = await getClaimRow(bundle.claim.id);
    const hidden = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hide",
      publicRationale: "Hiding after hold for transition coverage.",
      expectedVisibility: "held",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    expect(hidden.value.claim.moderationVisibility).toBe("hidden");

    claim = await getClaimRow(bundle.claim.id);
    const restored = await moderateClaim(db, {
      actorAccountId: MODERATOR,
      claimId: bundle.claim.id,
      action: "restore",
      publicRationale: "Restoring to visible for transition coverage.",
      expectedVisibility: "hidden",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.claim.moderationVisibility).toBe("visible");
    expect(restored.value.action.toVisibility).toBe("visible");
    expect(restored.value.action.toVisibility).not.toBe("restored" as never);

    // visible → hide is also allowed.
    claim = await getClaimRow(bundle.claim.id);
    const hideFromVisible = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hide",
      publicRationale: "Hide directly from visible.",
      expectedVisibility: "visible",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(hideFromVisible.ok).toBe(true);

    claim = await getClaimRow(bundle.claim.id);
    const restoreFromHeldPath = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "restore",
      publicRationale: "Restore from hidden before held path check.",
      expectedVisibility: "hidden",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(restoreFromHeldPath.ok).toBe(true);
    claim = await getClaimRow(bundle.claim.id);
    const holdAgain = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "Hold again for held→visible restore.",
      expectedVisibility: "visible",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(holdAgain.ok).toBe(true);
    claim = await getClaimRow(bundle.claim.id);
    const restoreFromHeld = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "restore",
      publicRationale: "Restore from held lands on visible.",
      expectedVisibility: "held",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(restoreFromHeld.ok).toBe(true);
    if (!restoreFromHeld.ok) return;
    expect(restoreFromHeld.value.claim.moderationVisibility).toBe("visible");
  });

  it("rejects invalid and no-op transitions", async () => {
    const bundle = await submitBundle("invalid-transition");
    const claim = await getClaimRow(bundle.claim.id);

    const restoreFromVisible = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "restore",
      publicRationale: "Cannot restore from visible.",
      expectedVisibility: "visible",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(restoreFromVisible.ok).toBe(false);
    if (!restoreFromVisible.ok) {
      expect(restoreFromVisible.code).toBe("MODERATION_TRANSITION_INVALID");
    }

    const held = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "Hold before invalid hold-again.",
      expectedVisibility: "visible",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(held.ok).toBe(true);
    if (!held.ok) return;

    const holdAgain = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "Hold is not allowed from held.",
      expectedVisibility: "held",
      expectedUpdatedAt: held.value.claim.updatedAt.toISOString(),
    });
    expect(holdAgain.ok).toBe(false);
    if (!holdAgain.ok) {
      expect(holdAgain.code).toBe("MODERATION_TRANSITION_INVALID");
    }
  });

  it("denies participant moderation and allows moderator and administrator", async () => {
    const bundle = await submitBundle("authz");
    const claim = await getClaimRow(bundle.claim.id);

    const denied = await moderateClaim(db, {
      actorAccountId: PARTICIPANT,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "Participant must not moderate.",
      expectedVisibility: "visible",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toMatch(/AUTHZ/);
    }
    expect((await getClaimRow(bundle.claim.id)).moderationVisibility).toBe(
      "visible",
    );

    const byModerator = await moderateClaim(db, {
      actorAccountId: MODERATOR,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "Moderator hold is allowed.",
      expectedVisibility: "visible",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(byModerator.ok).toBe(true);
    if (!byModerator.ok) return;

    const byAdmin = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hide",
      publicRationale: "Administrator hide is allowed.",
      expectedVisibility: "held",
      expectedUpdatedAt: byModerator.value.claim.updatedAt.toISOString(),
    });
    expect(byAdmin.ok).toBe(true);
  });

  it("stale writer yields MODERATION_STATE_CONFLICT with no partial rows", async () => {
    const bundle = await submitBundle("stale");
    const claim = await getClaimRow(bundle.claim.id);
    const actionsBefore = await db
      .select()
      .from(moderationActions)
      .where(eq(moderationActions.claimId, bundle.claim.id));
    const auditsBefore = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "moderation.submission_held"));

    const stale = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "Stale expectedUpdatedAt must fail.",
      expectedVisibility: "visible",
      expectedUpdatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("MODERATION_STATE_CONFLICT");

    const after = await getClaimRow(bundle.claim.id);
    expect(after.moderationVisibility).toBe("visible");
    expect(after.updatedAt.toISOString()).toBe(claim.updatedAt.toISOString());

    const actionsAfter = await db
      .select()
      .from(moderationActions)
      .where(eq(moderationActions.claimId, bundle.claim.id));
    expect(actionsAfter.length).toBe(actionsBefore.length);

    const auditsAfter = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "moderation.submission_held"));
    expect(auditsAfter.length).toBe(auditsBefore.length);
  });

  it("concurrent moderation writers with one token: one success, one conflict", async () => {
    const bundle = await submitBundle("concurrent-mod");
    const claim = await getClaimRow(bundle.claim.id);
    const token = claim.updatedAt.toISOString();
    const actionsBefore = await db
      .select()
      .from(moderationActions)
      .where(eq(moderationActions.claimId, bundle.claim.id));
    const auditsBefore = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "moderation.submission_held"));

    const [first, second] = await Promise.all([
      moderateClaim(db, {
        actorAccountId: ADMIN,
        claimId: bundle.claim.id,
        action: "hold",
        publicRationale: "Concurrent writer A hold.",
        expectedVisibility: "visible",
        expectedUpdatedAt: token,
      }),
      moderateClaim(db, {
        actorAccountId: ADMIN,
        claimId: bundle.claim.id,
        action: "hold",
        publicRationale: "Concurrent writer B hold.",
        expectedVisibility: "visible",
        expectedUpdatedAt: token,
      }),
    ]);

    const outcomes = [first, second];
    const successes = outcomes.filter((row) => row.ok);
    const conflicts = outcomes.filter(
      (row) => !row.ok && row.code === "MODERATION_STATE_CONFLICT",
    );
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);

    const after = await getClaimRow(bundle.claim.id);
    expect(after.moderationVisibility).toBe("held");
    expect(after.updatedAt.getTime()).toBeGreaterThan(claim.updatedAt.getTime());

    const actionsAfter = await db
      .select()
      .from(moderationActions)
      .where(eq(moderationActions.claimId, bundle.claim.id));
    expect(actionsAfter.length).toBe(actionsBefore.length + 1);

    const auditsAfter = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "moderation.submission_held"));
    expect(auditsAfter.length).toBe(auditsBefore.length + 1);
  });

  it("rolls back visibility when appendModerationAction fails", async () => {
    const bundle = await submitBundle("modact-rollback");
    const claim = await getClaimRow(bundle.claim.id);
    const spy = vi
      .spyOn(moderationRepository, "appendModerationAction")
      .mockResolvedValue({
        ok: false,
        error: "forced moderation action failure",
        code: "MODERATION_ACTION_INSERT_FAILED",
      });
    try {
      const result = await moderateClaim(db, {
        actorAccountId: ADMIN,
        claimId: bundle.claim.id,
        action: "hold",
        publicRationale: "Should roll back on action insert failure.",
        expectedVisibility: "visible",
        expectedUpdatedAt: claim.updatedAt.toISOString(),
      });
      expect(result.ok).toBe(false);
    } finally {
      spy.mockRestore();
    }
    const after = await getClaimRow(bundle.claim.id);
    expect(after.moderationVisibility).toBe("visible");
    expect(after.updatedAt.toISOString()).toBe(claim.updatedAt.toISOString());
  });

  it("rolls back visibility when appendAuthAudit fails", async () => {
    const bundle = await submitBundle("audit-rollback");
    const claim = await getClaimRow(bundle.claim.id);
    const spy = vi
      .spyOn(auditModule, "appendAuthAudit")
      .mockRejectedValue(new Error("forced audit failure"));
    try {
      const result = await moderateClaim(db, {
        actorAccountId: ADMIN,
        claimId: bundle.claim.id,
        action: "hold",
        publicRationale: "Should roll back on audit failure.",
        expectedVisibility: "visible",
        expectedUpdatedAt: claim.updatedAt.toISOString(),
      });
      expect(result.ok).toBe(false);
    } finally {
      spy.mockRestore();
    }
    const after = await getClaimRow(bundle.claim.id);
    expect(after.moderationVisibility).toBe("visible");
    const actions = await db
      .select()
      .from(moderationActions)
      .where(eq(moderationActions.claimId, bundle.claim.id));
    expect(actions).toHaveLength(0);
  });

  it("moderating claim does not change linked evidence axes (and vice versa)", async () => {
    const bundle = await submitBundle("axis-isolation");
    const claimBefore = await getClaimRow(bundle.claim.id);
    const evidenceBefore = await getEvidenceRow(bundle.evidence.id);

    const claimHeld = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "Claim hold must leave evidence unchanged.",
      expectedVisibility: "visible",
      expectedUpdatedAt: claimBefore.updatedAt.toISOString(),
    });
    expect(claimHeld.ok).toBe(true);

    const evidenceAfterClaim = await getEvidenceRow(bundle.evidence.id);
    expect(evidenceAfterClaim.moderationVisibility).toBe(
      evidenceBefore.moderationVisibility,
    );
    expect(evidenceAfterClaim.workflowState).toBe(evidenceBefore.workflowState);
    expect(evidenceAfterClaim.qualityStatus).toBe(evidenceBefore.qualityStatus);
    expect(evidenceAfterClaim.updatedAt.toISOString()).toBe(
      evidenceBefore.updatedAt.toISOString(),
    );

    const evidenceHeld = await moderateEvidence(db, {
      actorAccountId: MODERATOR,
      evidenceSubmissionId: bundle.evidence.id,
      action: "hide",
      publicRationale: "Evidence hide must leave claim unchanged.",
      expectedVisibility: "visible",
      expectedUpdatedAt: evidenceAfterClaim.updatedAt.toISOString(),
    });
    expect(evidenceHeld.ok).toBe(true);

    const claimAfterEvidence = await getClaimRow(bundle.claim.id);
    expect(claimAfterEvidence.moderationVisibility).toBe("held");
    expect(claimAfterEvidence.workflowState).toBe(claimBefore.workflowState);
    expect(claimAfterEvidence.title).toBe(claimBefore.title);
  });

  it("moderation does not delete content_revisions", async () => {
    const bundle = await submitBundle("revisions-preserved");
    await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "changes_requested",
      publicRationale: "Need an edit to create a revision before moderation.",
      expectedWorkflowState: "submitted",
    });
    const beforeEdit = await getClaimRow(bundle.claim.id);
    const edited = await updateOwnClaimContent(db, {
      actorAccountId: PARTICIPANT,
      claimId: bundle.claim.id,
      expectedUpdatedAt: beforeEdit.updatedAt.toISOString(),
      title: beforeEdit.title,
      summary: "Revised summary before moderation.",
      approachLabel: beforeEdit.approachLabel,
    });
    expect(edited.ok).toBe(true);

    const revisionsBefore = await db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.claimId, bundle.claim.id));
    expect(revisionsBefore.length).toBeGreaterThanOrEqual(1);

    const claim = await getClaimRow(bundle.claim.id);
    const held = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "Hold must not erase revision history.",
      expectedVisibility: "visible",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(held.ok).toBe(true);

    const revisionsAfter = await db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.claimId, bundle.claim.id));
    expect(revisionsAfter).toHaveLength(revisionsBefore.length);
  });

  it("requires a non-blank public rationale", async () => {
    const bundle = await submitBundle("blank-rationale");
    const claim = await getClaimRow(bundle.claim.id);
    const blank = await moderateClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      action: "hold",
      publicRationale: "   ",
      expectedVisibility: "visible",
      expectedUpdatedAt: claim.updatedAt.toISOString(),
    });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.code).toBe("MODERATION_INPUT_INVALID");
    expect((await getClaimRow(bundle.claim.id)).moderationVisibility).toBe(
      "visible",
    );
  });

  it("toPublicModerationNotice exposes only action, publicRationale, recordedAt", () => {
    const notice = toPublicModerationNotice({
      action: "hold",
      publicRationale: "Public reason only.",
      createdAt: new Date("2026-08-11T12:00:00.000Z"),
    });
    expect(notice).toEqual({
      action: "hold",
      publicRationale: "Public reason only.",
      recordedAt: "2026-08-11T12:00:00.000Z",
    });
    expect(Object.keys(notice).sort()).toEqual([
      "action",
      "publicRationale",
      "recordedAt",
    ]);
  });
});
