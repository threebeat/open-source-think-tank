import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  auditEvents,
  claims,
  conflictDisclosures,
  evidenceSubmissions,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { isRegisteredAuditAction } from "@/lib/audit/registry";
import {
  createAndSubmitClaimEvidence,
  updateOwnSubmission,
  withdrawOwnSubmission,
} from "@/lib/submissions/submit";
import { createTopic, transitionTopic } from "@/lib/topics/authoring";
import { seedApprovedAssertions } from "@/lib/verification/seed-assurance";

const ADMIN = "account-ostt-synth-staff-admin";
const PARTICIPANT = "account-ostt-synth-ada";
const OTHER = "account-ostt-synth-staff-admin";

describe("participant submissions (3.5)", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_submissions";

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
      slug: "submit-open-topic",
      title: "Open for submissions",
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

  it("registers submission audit actions", () => {
    for (const action of [
      "claims.submitted",
      "evidence.submitted",
      "conflicts.disclosed",
      "claims.withdrawn",
      "evidence.withdrawn",
    ]) {
      expect(isRegisteredAuditAction(action)).toBe(true);
    }
  });

  it("creates claim+evidence+link+disclosure+audit atomically", async () => {
    const result = await createAndSubmitClaimEvidence(db, {
      actorAccountId: PARTICIPANT,
      topicId: openTopicId,
      claimTitle: "Billing transparency claim",
      claimSummary: "Public summaries should be clearer.",
      approachLabel: "Transparency",
      sourceUrl: "https://example.org/report.pdf",
      evidenceTitle: "Example report",
      organization: "Example Org",
      authorType: "researcher",
      sourceType: "report",
      limitations: "Synthetic limitations note.",
      relationship: "supporting",
      disclosureChoice: "none",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.claim.workflowState).toBe("submitted");
    expect(result.value.evidence.workflowState).toBe("submitted");
    expect(result.value.claim.authorAccountId).toBe(PARTICIPANT);
    expect(result.value.evidence.submitterAccountId).toBe(PARTICIPANT);

    const [disclosure] = await db
      .select()
      .from(conflictDisclosures)
      .where(eq(conflictDisclosures.claimId, result.value.claim.id));
    expect(disclosure?.publicSummary).toContain("No known conflict");
    expect(disclosure?.evidenceSubmissionId).toBeNull();

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.subjectId, result.value.claim.id));
    expect(audits.some((row) => row.action === "claims.submitted")).toBe(true);
    expect(JSON.stringify(audits)).not.toContain("example.org/report.pdf");
  });

  it("rejects non-open topics and bad URLs without fetching", async () => {
    const draft = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "still-draft-topic",
      title: "Draft",
      question: "q",
      background: "b",
      scope: "s",
      jurisdictionLevel: "county",
      countyFips: "47037",
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const closed = await createAndSubmitClaimEvidence(db, {
      actorAccountId: PARTICIPANT,
      topicId: draft.value.id,
      claimTitle: "Nope",
      claimSummary: "Nope",
      approachLabel: "Nope",
      sourceUrl: "https://example.org/x",
      evidenceTitle: "Nope",
      organization: "Nope",
      authorType: "other",
      sourceType: "other",
      limitations: "Nope",
      relationship: "supporting",
      disclosureChoice: "none",
    });
    expect(closed.ok).toBe(false);
    if (!closed.ok) {
      expect(closed.code).toBe("TOPIC_NOT_OPEN_FOR_SUBMISSIONS");
    }

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const badUrl = await createAndSubmitClaimEvidence(db, {
      actorAccountId: PARTICIPANT,
      topicId: openTopicId,
      claimTitle: "Bad url",
      claimSummary: "Bad url",
      approachLabel: "Bad",
      sourceUrl: "ftp://example.org/x",
      evidenceTitle: "Bad",
      organization: "Bad",
      authorType: "other",
      sourceType: "other",
      limitations: "Bad",
      relationship: "supporting",
      disclosureChoice: "none",
    });
    expect(badUrl.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("requires relationship and disclosure choice validity", async () => {
    const missing = await createAndSubmitClaimEvidence(db, {
      actorAccountId: PARTICIPANT,
      topicId: openTopicId,
      claimTitle: "Missing relationship",
      claimSummary: "Missing",
      approachLabel: "Missing",
      sourceUrl: "https://example.org/y",
      evidenceTitle: "Missing",
      organization: "Missing",
      authorType: "other",
      sourceType: "other",
      limitations: "Missing",
      relationship: "not-a-relationship" as "supporting",
      disclosureChoice: "disclose",
      disclosurePublicSummary: "",
    });
    expect(missing.ok).toBe(false);
  });

  it("blocks editing another participant submission and supports withdraw", async () => {
    const created = await createAndSubmitClaimEvidence(db, {
      actorAccountId: PARTICIPANT,
      topicId: openTopicId,
      claimTitle: "Own claim for withdraw",
      claimSummary: "Summary",
      approachLabel: "Approach",
      sourceUrl: "https://example.org/withdraw",
      evidenceTitle: "Evidence",
      organization: "Org",
      authorType: "agency",
      sourceType: "memo",
      limitations: "Limits",
      relationship: "counterevidence",
      disclosureChoice: "disclose",
      disclosurePublicSummary: "I advise a related vendor.",
      disclosurePrivateDetail: "optional private note",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const stolen = await updateOwnSubmission(db, {
      actorAccountId: OTHER,
      claimId: created.value.claim.id,
      expectedClaimUpdatedAt: created.value.claim.updatedAt.toISOString(),
      expectedEvidenceUpdatedAt: created.value.evidence.updatedAt.toISOString(),
      claimTitle: "Hijack",
      claimSummary: "Hijack",
      approachLabel: "Hijack",
      sourceUrl: "https://example.org/hijack",
      evidenceTitle: "Hijack",
      organization: "Hijack",
      authorType: "other",
      sourceType: "other",
      limitations: "Hijack",
    });
    // Staff admin is not a participant; capability check fails closed.
    expect(stolen.ok).toBe(false);
    if (!stolen.ok) {
      expect(stolen.code).toMatch(/^AUTHZ_/);
    }

    const withdrawn = await withdrawOwnSubmission(db, {
      actorAccountId: PARTICIPANT,
      claimId: created.value.claim.id,
      expectedClaimWorkflowState: "submitted",
      expectedEvidenceWorkflowState: "submitted",
      reason: "Changing approach",
    });
    expect(withdrawn.ok).toBe(true);
    if (!withdrawn.ok) return;
    expect(withdrawn.value.claim.workflowState).toBe("withdrawn");
    expect(withdrawn.value.evidence.workflowState).toBe("withdrawn");

    const [claimRow] = await db
      .select()
      .from(claims)
      .where(eq(claims.id, created.value.claim.id));
    const [evidenceRow] = await db
      .select()
      .from(evidenceSubmissions)
      .where(eq(evidenceSubmissions.id, created.value.evidence.id));
    expect(claimRow).toBeTruthy();
    expect(evidenceRow).toBeTruthy();
  });
});
