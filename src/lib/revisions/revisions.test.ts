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
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { isRegisteredAuditAction } from "@/lib/audit/registry";
import { reviewClaim } from "@/lib/claims/review";
import { reviewEvidenceWorkflow } from "@/lib/evidence/review";
import {
  getOwnClaimRevisionHistory,
  getStaffClaimRevisionHistory,
  toPublicRevisionSummary,
} from "@/lib/revisions/history";
import {
  listClaimContentRevisions,
  listEvidenceContentRevisions,
} from "@/lib/revisions/repository";
import {
  createAndSubmitClaimEvidence,
  updateOwnClaimContent,
  updateOwnEvidenceContent,
  withdrawOwnClaim,
} from "@/lib/submissions/submit";
import { createTopic, transitionTopic } from "@/lib/topics/authoring";
import { buildPublicTopicProjection } from "@/lib/topics/public-projection";
import { seedApprovedAssertions } from "@/lib/verification/seed-assurance";

const ADMIN = "account-ostt-synth-staff-admin";
const PARTICIPANT = "account-ostt-synth-ada";
const OTHER = "account-ostt-synth-staff-admin";

describe("content revisions (3.7)", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_revisions";

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
      slug: "revision-open-topic",
      title: "Open for revision tests",
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

  it("registers revision audit actions", () => {
    expect(isRegisteredAuditAction("claims.revision_recorded")).toBe(true);
    expect(isRegisteredAuditAction("evidence.revision_recorded")).toBe(true);
  });

  it("enforces exactly-one-subject, positive unique revision numbers, and immutability", async () => {
    const bundle = await submitBundle("db-constraints");
    await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "changes_requested",
      publicRationale: "Please clarify the claim summary wording.",
      expectedWorkflowState: "submitted",
    });
    const edited = await updateOwnClaimContent(db, {
      actorAccountId: PARTICIPANT,
      claimId: bundle.claim.id,
      expectedUpdatedAt: (
        await getClaimUpdatedAt(bundle.claim.id)
      ).toISOString(),
      title: bundle.claim.title,
      summary: "Revised summary for constraint coverage.",
      approachLabel: bundle.claim.approachLabel,
    });
    expect(edited.ok).toBe(true);

    const [rev] = await db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.claimId, bundle.claim.id));
    expect(rev).toBeTruthy();

    await expect(
      db.execute(sql`
        INSERT INTO content_revisions (
          id, topic_id, claim_id, evidence_submission_id, revision_number,
          editor_account_id, changed_fields, before_snapshot, after_snapshot, synthetic
        ) VALUES (
          'crev_both_subjects', ${openTopicId}, ${bundle.claim.id}, ${bundle.evidence.id},
          99, ${PARTICIPANT}, ARRAY['title'],
          '{"title":"a","summary":"b","approachLabel":"c"}'::jsonb,
          '{"title":"a","summary":"b","approachLabel":"c"}'::jsonb,
          true
        )
      `),
    ).rejects.toThrow();

    await expect(
      db.execute(sql`
        INSERT INTO content_revisions (
          id, topic_id, claim_id, evidence_submission_id, revision_number,
          editor_account_id, changed_fields, before_snapshot, after_snapshot, synthetic
        ) VALUES (
          'crev_neither_subject', ${openTopicId}, NULL, NULL,
          98, ${PARTICIPANT}, ARRAY['title'],
          '{"title":"a","summary":"b","approachLabel":"c"}'::jsonb,
          '{"title":"a","summary":"b","approachLabel":"c"}'::jsonb,
          true
        )
      `),
    ).rejects.toThrow();

    await expect(
      db
        .update(contentRevisions)
        .set({ revisionNumber: 2 })
        .where(eq(contentRevisions.id, rev!.id)),
    ).rejects.toThrow(/immutable|Failed query/i);

    await expect(
      db.delete(contentRevisions).where(eq(contentRevisions.id, rev!.id)),
    ).rejects.toThrow(/immutable|Failed query/i);
  });

  it("records claim revision atomically after changes_requested edit", async () => {
    const bundle = await submitBundle("claim-rev");
    await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "changes_requested",
      publicRationale: "Please tighten the approach label.",
      expectedWorkflowState: "submitted",
    });
    const before = await getClaimRow(bundle.claim.id);
    const result = await updateOwnClaimContent(db, {
      actorAccountId: PARTICIPANT,
      claimId: bundle.claim.id,
      expectedUpdatedAt: before.updatedAt.toISOString(),
      title: before.title,
      summary: before.summary,
      approachLabel: "Tightened approach",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.revisionRecorded).toBe(true);
    expect(result.value.claim.approachLabel).toBe("Tightened approach");
    expect(result.value.claim.workflowState).toBe("changes_requested");

    const revisions = await listClaimContentRevisions(db, bundle.claim.id);
    expect(revisions.ok).toBe(true);
    if (!revisions.ok) return;
    expect(revisions.value).toHaveLength(1);
    expect(revisions.value[0]!.changedFields).toEqual(["approachLabel"]);
    expect(revisions.value[0]!.beforeSnapshot).toMatchObject({
      approachLabel: bundle.claim.approachLabel,
    });
    expect(revisions.value[0]!.afterSnapshot).toMatchObject({
      approachLabel: "Tightened approach",
    });

    const revisionAudits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "claims.revision_recorded"));
    expect(
      revisionAudits.some((row) => row.subjectId === bundle.claim.id),
    ).toBe(true);
    expect(JSON.stringify(revisionAudits)).not.toContain("Tightened approach");

    // Workflow, quality, moderation, and links unchanged for evidence.
    const [evidence] = await db
      .select()
      .from(evidenceSubmissions)
      .where(eq(evidenceSubmissions.id, bundle.evidence.id));
    expect(evidence?.workflowState).toBe("submitted");
    expect(evidence?.qualityStatus).toBe("pending");
  });

  it("records evidence revision for every allowlisted field change", async () => {
    const bundle = await submitBundle("evidence-rev");
    await reviewEvidenceWorkflow(db, {
      actorAccountId: ADMIN,
      evidenceSubmissionId: bundle.evidence.id,
      decision: "changes_requested",
      publicRationale: "Please expand limitations and update organization.",
      expectedWorkflowState: "submitted",
    });
    const before = await getEvidenceRow(bundle.evidence.id);
    const result = await updateOwnEvidenceContent(db, {
      actorAccountId: PARTICIPANT,
      evidenceSubmissionId: bundle.evidence.id,
      expectedUpdatedAt: before.updatedAt.toISOString(),
      sourceUrl: "https://example.org/evidence-rev-updated",
      title: "Evidence evidence-rev updated",
      organization: "Org evidence-rev updated",
      authorType: "researcher",
      sourceType: "report",
      limitations: "Expanded limitations for revision coverage.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.revisionRecorded).toBe(true);

    const revisions = await listEvidenceContentRevisions(db, bundle.evidence.id);
    expect(revisions.ok).toBe(true);
    if (!revisions.ok) return;
    expect(revisions.value[0]!.changedFields).toEqual([
      "sourceUrl",
      "title",
      "organization",
      "authorType",
      "sourceType",
      "limitations",
    ]);

    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, bundle.claim.id));
    expect(claim?.workflowState).toBe("submitted");
  });

  it("treats true no-ops as silent and draft edits as unversioned", async () => {
    const draftTopic = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "revision-draft-topic",
      title: "Draft topic",
      question: "q",
      background: "b",
      scope: "s",
      jurisdictionLevel: "statewide",
      countyFips: null,
    });
    expect(draftTopic.ok).toBe(true);
    if (!draftTopic.ok) throw new Error("draft topic failed");
    await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: draftTopic.value.id,
      action: "open",
      expectedWorkflowState: "draft",
    });

    // Insert a draft claim directly (never submitted).
    const { insertClaim } = await import("@/lib/claims/repository");
    const draft = await insertClaim(db, {
      topicId: draftTopic.value.id,
      authorAccountId: PARTICIPANT,
      title: "Draft claim",
      summary: "Draft summary",
      approachLabel: "Draft approach",
      synthetic: true,
      workflowState: "draft",
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const draftEdit = await updateOwnClaimContent(db, {
      actorAccountId: PARTICIPANT,
      claimId: draft.value.id,
      expectedUpdatedAt: draft.value.updatedAt.toISOString(),
      title: "Draft claim edited",
      summary: "Draft summary",
      approachLabel: "Draft approach",
    });
    expect(draftEdit.ok).toBe(true);
    if (!draftEdit.ok) return;
    expect(draftEdit.value.revisionRecorded).toBe(false);
    const draftRevs = await listClaimContentRevisions(db, draft.value.id);
    expect(draftRevs.ok && draftRevs.value.length === 0).toBe(true);

    const noop = await updateOwnClaimContent(db, {
      actorAccountId: PARTICIPANT,
      claimId: draft.value.id,
      expectedUpdatedAt: draftEdit.value.claim.updatedAt.toISOString(),
      title: "Draft claim edited",
      summary: "Draft summary",
      approachLabel: "Draft approach",
    });
    expect(noop.ok).toBe(true);
    if (!noop.ok) return;
    expect(noop.value.noop).toBe(true);
    expect(noop.value.claim.updatedAt.toISOString()).toBe(
      draftEdit.value.claim.updatedAt.toISOString(),
    );
  });

  it("fails closed for foreign ownership, stale state, and public-demo", async () => {
    const bundle = await submitBundle("fail-closed");
    await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "changes_requested",
      publicRationale: "Need a clearer summary for ownership tests.",
      expectedWorkflowState: "submitted",
    });
    const before = await getClaimRow(bundle.claim.id);

    const foreign = await updateOwnClaimContent(db, {
      actorAccountId: OTHER,
      claimId: bundle.claim.id,
      expectedUpdatedAt: before.updatedAt.toISOString(),
      title: "Stolen",
      summary: before.summary,
      approachLabel: before.approachLabel,
    });
    expect(foreign.ok).toBe(false);

    const stale = await updateOwnClaimContent(db, {
      actorAccountId: PARTICIPANT,
      claimId: bundle.claim.id,
      expectedUpdatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
      title: before.title,
      summary: "Stale write should fail",
      approachLabel: before.approachLabel,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("SUBMISSION_STATE_CONFLICT");

    const previous = process.env.APP_MODE;
    const previousSecrets: Record<string, string | undefined> = {};
    for (const key of [
      "DATABASE_URL",
      "AUTH_SECRET",
      "AUTH_URL",
      "EMAIL_API_KEY",
      "EMAIL_SERVER",
      "VERIFICATION_VENDOR_API_KEY",
      "OPERATOR_BOOTSTRAP_SECRET",
      "OPERATOR_RESET_SECRET",
    ] as const) {
      previousSecrets[key] = process.env[key];
      delete process.env[key];
    }
    process.env.APP_MODE = "public-demo";
    try {
      await expect(
        updateOwnClaimContent(db, {
          actorAccountId: PARTICIPANT,
          claimId: bundle.claim.id,
          expectedUpdatedAt: before.updatedAt.toISOString(),
          title: before.title,
          summary: "Should not write in public-demo",
          approachLabel: before.approachLabel,
        }),
      ).resolves.toMatchObject({ ok: false });
    } finally {
      process.env.APP_MODE = previous;
      for (const [key, value] of Object.entries(previousSecrets)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }

    const revs = await listClaimContentRevisions(db, bundle.claim.id);
    expect(revs.ok && revs.value.length === 0).toBe(true);
  });

  it("rolls back content update when audit fails", async () => {
    const bundle = await submitBundle("audit-rollback");
    await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "changes_requested",
      publicRationale: "Need revision audit rollback coverage.",
      expectedWorkflowState: "submitted",
    });
    const before = await getClaimRow(bundle.claim.id);
    const spy = vi
      .spyOn(auditModule, "appendAuthAudit")
      .mockRejectedValue(new Error("forced audit failure"));
    try {
      const result = await updateOwnClaimContent(db, {
        actorAccountId: PARTICIPANT,
        claimId: bundle.claim.id,
        expectedUpdatedAt: before.updatedAt.toISOString(),
        title: before.title,
        summary: "Should roll back",
        approachLabel: before.approachLabel,
      });
      expect(result.ok).toBe(false);
    } finally {
      spy.mockRestore();
    }
    const after = await getClaimRow(bundle.claim.id);
    expect(after.summary).toBe(before.summary);
    const revs = await listClaimContentRevisions(db, bundle.claim.id);
    expect(revs.ok && revs.value.length === 0).toBe(true);
  });

  it("keeps revisions after withdraw and hides excluded subjects from public summary", async () => {
    const bundle = await submitBundle("public-summary");
    await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
      decision: "changes_requested",
      publicRationale: "Clarify before acceptance and later withdraw.",
      expectedWorkflowState: "submitted",
    });
    const before = await getClaimRow(bundle.claim.id);
    await updateOwnClaimContent(db, {
      actorAccountId: PARTICIPANT,
      claimId: bundle.claim.id,
      expectedUpdatedAt: before.updatedAt.toISOString(),
      title: before.title,
      summary: "Revised then withdrawn",
      approachLabel: before.approachLabel,
    });

    const ownerHistory = await getOwnClaimRevisionHistory(db, {
      actorAccountId: PARTICIPANT,
      claimId: bundle.claim.id,
    });
    expect(ownerHistory.ok).toBe(true);
    if (!ownerHistory.ok) return;
    expect(ownerHistory.value.entries).toHaveLength(1);
    expect(JSON.stringify(ownerHistory.value)).not.toContain(ADMIN);
    expect(JSON.stringify(ownerHistory.value)).not.toContain("private");

    const foreignHistory = await getOwnClaimRevisionHistory(db, {
      actorAccountId: OTHER,
      claimId: bundle.claim.id,
    });
    expect(foreignHistory.ok).toBe(false);

    const staffHistory = await getStaffClaimRevisionHistory(db, {
      actorAccountId: ADMIN,
      claimId: bundle.claim.id,
    });
    expect(staffHistory.ok).toBe(true);

    await withdrawOwnClaim(db, {
      actorAccountId: PARTICIPANT,
      claimId: bundle.claim.id,
      expectedWorkflowState: "changes_requested",
    });
    const afterWithdraw = await listClaimContentRevisions(db, bundle.claim.id);
    expect(afterWithdraw.ok && afterWithdraw.value.length === 1).toBe(true);

    const summary = toPublicRevisionSummary({
      count: 1,
      latestAt: new Date("2026-08-11T12:00:00.000Z"),
      changedFields: ["summary"],
    });
    expect(summary).toEqual({
      revisionCount: 1,
      latestRevisionAt: "2026-08-11T12:00:00.000Z",
      changedFieldLabels: ["summary updated"],
    });

    const projection = buildPublicTopicProjection({
      topic: {
        id: openTopicId,
        slug: "revision-open-topic",
        title: "t",
        question: "q",
        background: "b",
        scope: "s",
        workflowState: "under_review",
        publicationStatus: "published",
        jurisdictionLevel: "statewide",
        stateCode: "TN",
        countyFips: null,
        publishedAt: new Date("2026-08-11T12:00:00.000Z"),
      },
      claims: [
        {
          id: bundle.claim.id,
          title: before.title,
          summary: "Revised then withdrawn",
          approachLabel: before.approachLabel,
          workflowState: "withdrawn",
          moderationVisibility: "visible",
          workflowPublicRationale: null,
          conflictPublicSummary: null,
          revisionSummary: summary,
          latestModerationNotice: null,
        },
      ],
      evidence: [],
      links: [],
    });
    // Published topic stays addressable with an empty included-content shell (3.10).
    expect(projection).not.toBeNull();
    expect(projection!.claims).toEqual([]);
    expect(projection!.evidence).toEqual([]);
  });

  async function getClaimUpdatedAt(claimId: string): Promise<Date> {
    const row = await getClaimRow(claimId);
    return row.updatedAt;
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
});
