import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as auditModule from "@/lib/auth/audit-log";
import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  auditEvents,
  conflictDisclosures,
  roleAssignments,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { isRegisteredAuditAction } from "@/lib/audit/registry";
import { insertClaim } from "@/lib/claims/repository";
import { toPublicSummaryConflictDisclosure } from "@/lib/conflicts/audiences";
import {
  upsertOwnClaimDisclosure,
  upsertOwnEvidenceDisclosure,
} from "@/lib/conflicts/disclose";
import {
  getConflictDisclosureForClaim,
  insertConflictDisclosure,
} from "@/lib/conflicts/repository";
import { NO_CONFLICT_SUMMARY } from "@/lib/conflicts/schemas";
import { createAndSubmitClaimEvidence } from "@/lib/submissions/submit";
import { createTopic, transitionTopic } from "@/lib/topics/authoring";
import {
  L3_KINDS,
  seedApprovedAssertions,
} from "@/lib/verification/seed-assurance";

const ADMIN = "account-ostt-synth-staff-admin";
const PARTICIPANT = "account-ostt-synth-ada";
/** Second participant for ownership denial (activated in beforeAll). */
const OTHER_PARTICIPANT = "account-ostt-synth-ben";

describe("conflict disclosures (3.8)", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_conflicts";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);

    // Ada already has contact_continuity from synthetic seed.
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

    // Ben is a seed person/account without a platform role — activate as participant.
    await db.insert(roleAssignments).values({
      id: "role-ostt-synth-ben-participant-conflicts-test",
      accountId: OTHER_PARTICIPANT,
      role: "participant",
      grantedByLabel: "ostt-synth-conflicts-test",
      reason: "Second active participant for ownership denial coverage.",
    });
    await seedApprovedAssertions(db, OTHER_PARTICIPANT, L3_KINDS);
    await db
      .update(accounts)
      .set({
        lifecycleState: "active",
        activatedAt: new Date("2026-08-02T00:00:00.000Z"),
      })
      .where(eq(accounts.id, OTHER_PARTICIPANT));

    const topic = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "conflicts-open-topic",
      title: "Open for disclosure tests",
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

  it("registers conflicts.updated and conflicts.disclosed", () => {
    expect(isRegisteredAuditAction("conflicts.disclosed")).toBe(true);
    expect(isRegisteredAuditAction("conflicts.updated")).toBe(true);
  });

  it("owner can create claim and evidence disclosures", async () => {
    const claim = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: PARTICIPANT,
      title: "Disclosure create claim",
      summary: "Claim without prior disclosure for create path.",
      approachLabel: "Create path",
      synthetic: true,
      workflowState: "draft",
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;

    const claimDisc = await upsertOwnClaimDisclosure(db, {
      actorAccountId: PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "disclose",
      publicSummary: "Owner discloses a fictional advisory stipend.",
      privateDetail: "Private claim detail for staff boundary.",
    });
    expect(claimDisc.ok).toBe(true);
    if (!claimDisc.ok) return;
    expect(claimDisc.value.created).toBe(true);
    expect(claimDisc.value.disclosure.publicSummary).toBe(
      "Owner discloses a fictional advisory stipend.",
    );
    expect(claimDisc.value.disclosure.privateDetail).toBe(
      "Private claim detail for staff boundary.",
    );

    const bundle = await submitBundle("evidence-create");
    const evidenceDisc = await upsertOwnEvidenceDisclosure(db, {
      actorAccountId: PARTICIPANT,
      evidenceSubmissionId: bundle.evidence.id,
      disclosureChoice: "disclose",
      publicSummary: "Owner discloses a fictional evidence-related stipend.",
      privateDetail: "Private evidence detail for staff boundary.",
    });
    expect(evidenceDisc.ok).toBe(true);
    if (!evidenceDisc.ok) return;
    expect(evidenceDisc.value.created).toBe(true);
    expect(evidenceDisc.value.disclosure.evidenceSubmissionId).toBe(
      bundle.evidence.id,
    );
    expect(evidenceDisc.value.disclosure.privateDetail).toBe(
      "Private evidence detail for staff boundary.",
    );
  });

  it("true no-op does not bump updatedAt or emit conflicts.updated", async () => {
    const claim = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: PARTICIPANT,
      title: "No-op disclosure claim",
      summary: "Summary",
      approachLabel: "No-op",
      synthetic: true,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;

    const created = await upsertOwnClaimDisclosure(db, {
      actorAccountId: PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "disclose",
      publicSummary: "Stable public summary for no-op.",
      privateDetail: "Stable private detail.",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const auditsBefore = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "conflicts.updated"));

    const noop = await upsertOwnClaimDisclosure(db, {
      actorAccountId: PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "disclose",
      publicSummary: "Stable public summary for no-op.",
      privateDetail: "Stable private detail.",
      expectedUpdatedAt: created.value.disclosure.updatedAt.toISOString(),
    });
    expect(noop.ok).toBe(true);
    if (!noop.ok) return;
    expect(noop.value.created).toBe(false);
    expect(noop.value.disclosure.updatedAt.toISOString()).toBe(
      created.value.disclosure.updatedAt.toISOString(),
    );

    const auditsAfter = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "conflicts.updated"));
    expect(auditsAfter.length).toBe(auditsBefore.length);
  });

  it('choice "none" uses canonical summary and clears private detail', async () => {
    const claim = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: PARTICIPANT,
      title: "None choice claim",
      summary: "Summary",
      approachLabel: "None",
      synthetic: true,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;

    const disclosed = await upsertOwnClaimDisclosure(db, {
      actorAccountId: PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "disclose",
      publicSummary: "Temporary disclosure before clearing.",
      privateDetail: "Must be cleared on none.",
    });
    expect(disclosed.ok).toBe(true);
    if (!disclosed.ok) return;

    const cleared = await upsertOwnClaimDisclosure(db, {
      actorAccountId: PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "none",
      publicSummary: "ignored when none",
      privateDetail: "also ignored",
      expectedUpdatedAt: disclosed.value.disclosure.updatedAt.toISOString(),
    });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.value.disclosure.publicSummary).toBe(NO_CONFLICT_SUMMARY);
    expect(cleared.value.disclosure.privateDetail).toBeNull();
  });

  it("denies another participant without enumerating ownership", async () => {
    const claim = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: PARTICIPANT,
      title: "Owned by Ada",
      summary: "Summary",
      approachLabel: "Ownership",
      synthetic: true,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;

    await upsertOwnClaimDisclosure(db, {
      actorAccountId: PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "disclose",
      publicSummary: "Ada disclosure",
      privateDetail: "secret",
    });

    const foreign = await upsertOwnClaimDisclosure(db, {
      actorAccountId: OTHER_PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "disclose",
      publicSummary: "Should not overwrite",
      privateDetail: "stolen",
      expectedUpdatedAt: new Date().toISOString(),
    });
    expect(foreign.ok).toBe(false);
    if (foreign.ok) return;
    expect(foreign.code).toBe("DISCLOSURE_NOT_OWNED");
    expect(foreign.error.toLowerCase()).toMatch(/not found/);
    expect(JSON.stringify(foreign)).not.toContain("secret");
    expect(JSON.stringify(foreign)).not.toContain("Ada disclosure");
  });

  it("stale expectedUpdatedAt yields DISCLOSURE_STATE_CONFLICT without audit", async () => {
    const claim = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: PARTICIPANT,
      title: "Stale disclosure claim",
      summary: "Summary",
      approachLabel: "Stale",
      synthetic: true,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;

    const created = await upsertOwnClaimDisclosure(db, {
      actorAccountId: PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "disclose",
      publicSummary: "Original summary",
      privateDetail: "original private",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const auditsBefore = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "conflicts.updated"));

    const stale = await upsertOwnClaimDisclosure(db, {
      actorAccountId: PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "disclose",
      publicSummary: "Should not apply",
      privateDetail: "should not apply",
      expectedUpdatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.code).toBe("DISCLOSURE_STATE_CONFLICT");

    const auditsAfter = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "conflicts.updated"));
    expect(auditsAfter.length).toBe(auditsBefore.length);

    const current = await getConflictDisclosureForClaim(db, claim.value.id);
    expect(current.ok && current.value?.publicSummary).toBe("Original summary");
  });

  it("concurrent disclosure updates with one token: one success, one conflict", async () => {
    const claim = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: PARTICIPANT,
      title: "Concurrent disclosure claim",
      summary: "Summary",
      approachLabel: "Concurrent",
      synthetic: true,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;

    const created = await upsertOwnClaimDisclosure(db, {
      actorAccountId: PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "disclose",
      publicSummary: "Shared starting summary",
      privateDetail: "shared private",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const token = created.value.disclosure.updatedAt.toISOString();
    const auditsBefore = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "conflicts.updated"));

    const [first, second] = await Promise.all([
      upsertOwnClaimDisclosure(db, {
        actorAccountId: PARTICIPANT,
        claimId: claim.value.id,
        disclosureChoice: "disclose",
        publicSummary: "Writer A summary",
        privateDetail: "writer-a",
        expectedUpdatedAt: token,
      }),
      upsertOwnClaimDisclosure(db, {
        actorAccountId: PARTICIPANT,
        claimId: claim.value.id,
        disclosureChoice: "disclose",
        publicSummary: "Writer B summary",
        privateDetail: "writer-b",
        expectedUpdatedAt: token,
      }),
    ]);

    const outcomes = [first, second];
    const successes = outcomes.filter((row) => row.ok);
    const conflicts = outcomes.filter(
      (row) => !row.ok && row.code === "DISCLOSURE_STATE_CONFLICT",
    );
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);

    const current = await getConflictDisclosureForClaim(db, claim.value.id);
    expect(current.ok).toBe(true);
    if (!current.ok || !current.value) return;
    expect(["Writer A summary", "Writer B summary"]).toContain(
      current.value.publicSummary,
    );
    expect(current.value.updatedAt.getTime()).toBeGreaterThan(
      created.value.disclosure.updatedAt.getTime(),
    );

    const auditsAfter = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "conflicts.updated"));
    expect(auditsAfter.length).toBe(auditsBefore.length + 1);
  });

  it("rolls back disclosure update when appendAuthAudit fails", async () => {
    const claim = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: PARTICIPANT,
      title: "Audit rollback claim",
      summary: "Summary",
      approachLabel: "Rollback",
      synthetic: true,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;

    const created = await upsertOwnClaimDisclosure(db, {
      actorAccountId: PARTICIPANT,
      claimId: claim.value.id,
      disclosureChoice: "disclose",
      publicSummary: "Before audit failure",
      privateDetail: "before",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const spy = vi
      .spyOn(auditModule, "appendAuthAudit")
      .mockRejectedValue(new Error("forced audit failure"));
    try {
      const result = await upsertOwnClaimDisclosure(db, {
        actorAccountId: PARTICIPANT,
        claimId: claim.value.id,
        disclosureChoice: "disclose",
        publicSummary: "Should roll back",
        privateDetail: "rolled back",
        expectedUpdatedAt: created.value.disclosure.updatedAt.toISOString(),
      });
      expect(result.ok).toBe(false);
    } finally {
      spy.mockRestore();
    }

    const after = await getConflictDisclosureForClaim(db, claim.value.id);
    expect(after.ok && after.value?.publicSummary).toBe("Before audit failure");
    expect(after.ok && after.value?.privateDetail).toBe("before");
    expect(after.ok && after.value?.updatedAt.toISOString()).toBe(
      created.value.disclosure.updatedAt.toISOString(),
    );
  });

  it("toPublicSummaryConflictDisclosure never includes privateDetail", () => {
    const summary = toPublicSummaryConflictDisclosure({
      id: "cdisc_test",
      disclosingAccountId: PARTICIPANT,
      claimId: "claim_test",
      evidenceSubmissionId: null,
      publicSummary: "Public only",
      privateDetail: "SECRET_PRIVATE_DETAIL",
      synthetic: true,
      createdAt: new Date("2026-08-10T00:00:00.000Z"),
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    });
    expect(summary).toEqual({
      id: "cdisc_test",
      claimId: "claim_test",
      evidenceSubmissionId: null,
      publicSummary: "Public only",
      synthetic: true,
      createdAt: "2026-08-10T00:00:00.000Z",
    });
    expect(summary).not.toHaveProperty("privateDetail");
    expect(JSON.stringify(summary)).not.toContain("SECRET_PRIVATE_DETAIL");
  });

  it("DB uniqueness rejects a second disclosure for the same claim", async () => {
    const claim = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: PARTICIPANT,
      title: "Unique disclosure claim",
      summary: "Summary",
      approachLabel: "Unique",
      synthetic: true,
    });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;

    const first = await insertConflictDisclosure(db, {
      disclosingAccountId: PARTICIPANT,
      claimId: claim.value.id,
      evidenceSubmissionId: null,
      publicSummary: "First disclosure",
      privateDetail: null,
      synthetic: true,
    });
    expect(first.ok).toBe(true);

    await expect(
      insertConflictDisclosure(db, {
        disclosingAccountId: PARTICIPANT,
        claimId: claim.value.id,
        evidenceSubmissionId: null,
        publicSummary: "Second disclosure must fail",
        privateDetail: null,
        synthetic: true,
      }),
    ).rejects.toThrow();

    const rows = await db
      .select()
      .from(conflictDisclosures)
      .where(eq(conflictDisclosures.claimId, claim.value.id));
    expect(rows).toHaveLength(1);
  });
});
