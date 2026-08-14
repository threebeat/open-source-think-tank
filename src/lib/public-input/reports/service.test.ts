import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { auditEvents } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { createTopic } from "@/lib/topics/authoring";
import {
  createConversation,
  transitionConversation,
} from "@/lib/public-input/lifecycle/service";
import { CANONICAL_IMPORT_SCHEMA_VERSION } from "@/lib/public-input/reports/canonical-schema";
import {
  getReportGroupsByReportId,
  getReportImportById,
} from "@/lib/public-input/reports/repository";
import {
  assertNoProtectedReportFieldLeak,
  toPublicReportDto,
} from "@/lib/public-input/reports/projection";
import {
  beginReview,
  getPublishedReportForTopic,
  getStaffReportDetail,
  importAggregateReport,
  publishReport,
  rejectReport,
  validateReport,
  type ImportAggregateReportInput,
} from "@/lib/public-input/reports/service";

const ADMIN = "account-ostt-synth-staff-admin";
const MODERATOR = "account-ostt-synth-staff-moderator";

function fixturePayload(
  overrides: Partial<ImportAggregateReportInput["payload"] & object> = {},
) {
  return {
    schemaVersion: CANONICAL_IMPORT_SCHEMA_VERSION,
    sourceKind: "fixture" as const,
    methodVersion: "polis-export-v1",
    providerExportVersionLabel: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
    publicTitle: "Community input on billing changes",
    participationCount: 100,
    commentCount: 42,
    voteCount: 900,
    participationSufficiency: "Sufficient participation for this topic scope.",
    representationLimitations:
      "Self-selected online sample; not demographically representative.",
    opinionGroups: [
      { label: "Group A", share: 0.5 },
      { label: "Group B", share: 0.48 },
      { label: "Group C", share: 0.02 },
    ],
    crossGroupAgreement: ["Most participants agreed on statement one."],
    meaningfulDisagreement: ["Participants disagreed on statement two."],
    ...overrides,
  };
}

describe("Public Input aggregate report service (4.4)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previousMode: string | undefined;
  let previousDbUrl: string | undefined;
  let topicCounter = 0;

  beforeAll(async () => {
    previousMode = process.env.APP_MODE;
    previousDbUrl = process.env.DATABASE_URL;
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_public_input_reports";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client.close();
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
    if (previousDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDbUrl;
  });

  async function freshTopicId(): Promise<string> {
    topicCounter += 1;
    const created = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: `pinrpt-fixture-topic-${topicCounter}`,
      title: `Public Input report fixture topic ${topicCounter}`,
      question: "What should change?",
      background: "Background for a Public Input report fixture topic.",
      scope: "Alpha test scope.",
      jurisdictionLevel: "statewide",
      countyFips: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("failed to create fixture topic");
    return created.value.id;
  }

  /** Creates a conversation and walks it to `voting_closed` (import-eligible). */
  async function freshVotingClosedConversationId(
    topicId: string,
  ): Promise<string> {
    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Community input on billing changes",
      publicPrompt: "What tradeoffs matter most to you?",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("failed to create conversation");
    const conversationId = created.value.id;

    let version = created.value.version;
    let state = created.value.workflowState;
    const steps: Array<{ action: "mark_ready" | "open" | "close_commenting" | "close_voting" }> =
      [
        { action: "mark_ready" },
        { action: "open" },
        { action: "close_commenting" },
        { action: "close_voting" },
      ];
    for (const step of steps) {
      const result = await transitionConversation(db, {
        actorAccountId: ADMIN,
        conversationId,
        action: step.action,
        expectedWorkflowState: state,
        expectedVersion: version,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(`failed transition ${step.action}`);
      version = result.value.version;
      state = result.value.workflowState;
    }
    expect(state).toBe("voting_closed");
    return conversationId;
  }

  async function closeConversation(
    conversationId: string,
    expectedVersion: number,
  ): Promise<void> {
    const result = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId,
      action: "close",
      expectedWorkflowState: "voting_closed",
      expectedVersion,
      reason: "Voting window elapsed; closing consultation for reporting.",
    });
    expect(result.ok).toBe(true);
  }

  it("imports an aggregate report only when the conversation is voting_closed or closed, and denies moderators", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);

    const deniedForModerator = await importAggregateReport(db, {
      actorAccountId: MODERATOR,
      conversationId,
      publicTitle: "Should never import",
      payload: fixturePayload(),
    });
    expect(deniedForModerator.ok).toBe(false);
    if (!deniedForModerator.ok) {
      expect(deniedForModerator.code).toBe("AUTHZ_DENIED");
    }

    const imported = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      publicTitle: "Community input on billing changes",
      payload: fixturePayload(),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.reportVersion).toBe(1);
    expect(imported.value.isIdempotentReplay).toBe(false);

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectId, imported.value.importId),
          eq(auditEvents.action, "consultations.reports.imported"),
        ),
      );
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit)).not.toContain("providerConversationRef");
  });

  it("rejects import while the conversation is still draft", async () => {
    const topicId = await freshTopicId();
    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Draft-stage conversation",
      publicPrompt: "Draft prompt",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const imported = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      publicTitle: "Should not import",
      payload: fixturePayload(),
    });
    expect(imported.ok).toBe(false);
    if (!imported.ok) {
      expect(imported.code).toBe("CONSULTATION_NOT_READY_FOR_IMPORT");
    }
  });

  it("fails closed on a payload carrying forbidden or non-operational fields", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);

    const withForbiddenKey = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      publicTitle: "Should not import",
      payload: { ...fixturePayload(), xid: "provider-xid-123" },
    });
    expect(withForbiddenKey.ok).toBe(false);
    if (!withForbiddenKey.ok) {
      expect(withForbiddenKey.code).toBe("IMPORT_PAYLOAD_FORBIDDEN_KEYS");
    }

    const withLiveProviderSource = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      publicTitle: "Should not import",
      payload: { ...fixturePayload(), sourceKind: "polis_hosted" },
    });
    expect(withLiveProviderSource.ok).toBe(false);
    if (!withLiveProviderSource.ok) {
      expect(withLiveProviderSource.code).toBe(
        "IMPORT_PAYLOAD_SCHEMA_INVALID",
      );
    }
  });

  it("replays an identical re-import idempotently by canonical hash", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);
    const payload = fixturePayload();

    const first = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      publicTitle: "Community input on billing changes",
      payload,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.isIdempotentReplay).toBe(false);

    const second = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      publicTitle: "Community input on billing changes",
      payload,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.isIdempotentReplay).toBe(true);
    expect(second.value.importId).toBe(first.value.importId);
    expect(second.value.reportId).toBe(first.value.reportId);
    expect(second.value.reportVersion).toBe(first.value.reportVersion);
  });

  it("walks a report through validate -> review -> publish, applies complementary suppression, and denies moderator publish", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);

    const imported = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      publicTitle: "Community input on billing changes",
      payload: fixturePayload(),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const validated = await validateReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: 1,
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.workflowState).toBe("validated");

    const reviewed = await beginReview(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: validated.value.concurrencyVersion,
    });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(reviewed.value.workflowState).toBe("under_review");

    // Publish must fail while the conversation itself is not yet closed.
    const publishTooEarly = await publishReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
    });
    expect(publishTooEarly.ok).toBe(false);
    if (!publishTooEarly.ok) {
      expect(publishTooEarly.code).toBe("CONSULTATION_NOT_CLOSED_FOR_PUBLISH");
    }

    await closeConversation(conversationId, 5);

    const deniedForModerator = await publishReport(db, {
      actorAccountId: MODERATOR,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
    });
    expect(deniedForModerator.ok).toBe(false);
    if (!deniedForModerator.ok) {
      expect(deniedForModerator.code).toBe("AUTHZ_DENIED");
    }

    const published = await publishReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(published.value.workflowState).toBe("published");
    expect(published.value.isLatestPublished).toBe(true);
    expect(published.value.publishedAt).toBeTruthy();

    // Group C (share 0.02 -> implied 2 participants, below threshold 5) is
    // suppressed; the complementary rule then suppresses one more (Group B,
    // the smallest remaining positive share) so a single suppressed cell
    // can't be reconstructed from the total.
    const groups = await getReportGroupsByReportId(db, imported.value.reportId);
    expect(groups.ok).toBe(true);
    if (!groups.ok) return;
    const byLabel = new Map(groups.value.map((g) => [g.label, g]));
    expect(byLabel.get("Group C")?.publishedStatus).toBe("suppressed");
    expect(byLabel.get("Group C")?.publishedShare).toBeNull();
    expect(byLabel.get("Group B")?.publishedStatus).toBe("suppressed");
    expect(byLabel.get("Group B")?.publishedShare).toBeNull();
    expect(byLabel.get("Group A")?.publishedStatus).toBe("reported");
    expect(byLabel.get("Group A")?.publishedShare).toBe(0.5);

    const publicDto = await getPublishedReportForTopic(db, topicId);
    expect(publicDto.ok).toBe(true);
    if (!publicDto.ok || !publicDto.value) return;
    expect(publicDto.value.synthetic).toBe(true);
    expect(typeof publicDto.value.synthetic).toBe("boolean");
    expect(publicDto.value.suppressedCells).toBe(2);
    expect(publicDto.value.groupsOmitted).toBe(false);
    expect(
      publicDto.value.opinionGroups.find((g) => g.label === "Group C"),
    ).toEqual({ label: "Group C", status: "suppressed", share: null });
    expect(() => assertNoProtectedReportFieldLeak(publicDto.value!)).not.toThrow();
    expect(JSON.stringify(publicDto.value)).not.toContain("conversationId");
    expect(JSON.stringify(publicDto.value)).not.toContain("canonicalHash");
    expect(JSON.stringify(publicDto.value)).not.toContain("rawShare");

    const staffDetail = await getStaffReportDetail(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
    });
    expect(staffDetail.ok).toBe(true);
    if (!staffDetail.ok || !staffDetail.value) return;
    expect(staffDetail.value.conversationId).toBe(conversationId);
    expect(
      staffDetail.value.groups.find((g) => g.label === "Group C")?.rawShare,
    ).toBe(0.02);
  });

  it("omits all group shares outright when participation is below the reporting floor", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);

    const imported = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      publicTitle: "Small consultation",
      payload: fixturePayload({ participationCount: 3, voteCount: 12 }),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    await validateReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: 1,
    });
    const reviewed = await beginReview(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: 2,
    });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    await closeConversation(conversationId, 5);

    const published = await publishReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;

    const publicDto = await getPublishedReportForTopic(db, topicId);
    expect(publicDto.ok).toBe(true);
    if (!publicDto.ok || !publicDto.value) return;
    expect(publicDto.value.groupsOmitted).toBe(true);
    expect(publicDto.value.opinionGroups).toEqual([]);
  });

  it("supersedes the previously published report on a new publish for the same conversation", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);

    async function importValidateReviewPublish(label: string) {
      const imported = await importAggregateReport(db, {
        actorAccountId: ADMIN,
        conversationId,
        publicTitle: label,
        payload: fixturePayload({
          opinionGroups: [
            { label: "Group A", share: 0.6 },
            { label: "Group B", share: 0.4 },
          ],
          crossGroupAgreement: [`${label} agreement`],
        }),
      });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("import failed");

      const validated = await validateReport(db, {
        actorAccountId: ADMIN,
        reportId: imported.value.reportId,
        expectedConcurrencyVersion: 1,
      });
      expect(validated.ok).toBe(true);
      if (!validated.ok) throw new Error("validate failed");

      const reviewed = await beginReview(db, {
        actorAccountId: ADMIN,
        reportId: imported.value.reportId,
        expectedConcurrencyVersion: validated.value.concurrencyVersion,
      });
      expect(reviewed.ok).toBe(true);
      if (!reviewed.ok) throw new Error("review failed");

      return { imported, reviewed };
    }

    const first = await importValidateReviewPublish("Report v1");
    await closeConversation(conversationId, 5);

    const publishedFirst = await publishReport(db, {
      actorAccountId: ADMIN,
      reportId: first.imported.value.reportId,
      expectedConcurrencyVersion: first.reviewed.value.concurrencyVersion,
    });
    expect(publishedFirst.ok).toBe(true);
    if (!publishedFirst.ok) return;
    expect(publishedFirst.value.version).toBe(1);
    expect(publishedFirst.value.isLatestPublished).toBe(true);

    // Second import/validate/review re-runs against the same (closed)
    // conversation to produce version 2.
    const secondImported = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      publicTitle: "Report v2",
      payload: fixturePayload({
        opinionGroups: [
          { label: "Group A", share: 0.55 },
          { label: "Group B", share: 0.45 },
        ],
        crossGroupAgreement: ["Report v2 agreement"],
      }),
    });
    expect(secondImported.ok).toBe(true);
    if (!secondImported.ok) return;
    expect(secondImported.value.reportVersion).toBe(2);

    const secondValidated = await validateReport(db, {
      actorAccountId: ADMIN,
      reportId: secondImported.value.reportId,
      expectedConcurrencyVersion: 1,
    });
    expect(secondValidated.ok).toBe(true);
    if (!secondValidated.ok) return;

    const secondReviewed = await beginReview(db, {
      actorAccountId: ADMIN,
      reportId: secondImported.value.reportId,
      expectedConcurrencyVersion: secondValidated.value.concurrencyVersion,
    });
    expect(secondReviewed.ok).toBe(true);
    if (!secondReviewed.ok) return;

    const publishedSecond = await publishReport(db, {
      actorAccountId: ADMIN,
      reportId: secondImported.value.reportId,
      expectedConcurrencyVersion: secondReviewed.value.concurrencyVersion,
    });
    expect(publishedSecond.ok).toBe(true);
    if (!publishedSecond.ok) return;
    expect(publishedSecond.value.version).toBe(2);
    expect(publishedSecond.value.isLatestPublished).toBe(true);

    const staffFirstAfter = await getStaffReportDetail(db, {
      actorAccountId: ADMIN,
      reportId: first.imported.value.reportId,
    });
    expect(staffFirstAfter.ok).toBe(true);
    if (!staffFirstAfter.ok || !staffFirstAfter.value) return;
    expect(staffFirstAfter.value.workflowState).toBe("superseded");
    expect(staffFirstAfter.value.isLatestPublished).toBe(false);
    expect(staffFirstAfter.value.supersededByReportId).toBe(
      secondImported.value.reportId,
    );

    const publicDto = await getPublishedReportForTopic(db, topicId);
    expect(publicDto.ok).toBe(true);
    if (!publicDto.ok || !publicDto.value) return;
    expect(publicDto.value.reportVersion).toBe(2);
    expect(publicDto.value.publicTitle).toBe("Report v2");
  });

  it("rejects a report with a substantive reason and refuses a blank/short reason", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);

    const imported = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      publicTitle: "To be rejected",
      payload: fixturePayload(),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const shortReason = await rejectReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: 1,
      reason: "no",
    });
    expect(shortReason.ok).toBe(false);
    if (!shortReason.ok) {
      expect(shortReason.code).toBe("PUBLIC_INPUT_REPORT_REASON_REQUIRED");
    }

    // rejectReport only accepts `validated` / `under_review` reports.
    const validated = await validateReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: 1,
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const rejected = await rejectReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: validated.value.concurrencyVersion,
      reason: "Methodology mismatch versus the consultation's published prompt.",
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.value.workflowState).toBe("rejected");
  });

  it("returns null (not an error) for a topic with no published report", async () => {
    const topicId = await freshTopicId();
    const dto = await getPublishedReportForTopic(db, topicId);
    expect(dto.ok).toBe(true);
    if (dto.ok) {
      expect(dto.value).toBeNull();
    }
  });

  it("never leaks protected fields through the public projection even when constructed directly", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);
    const imported = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      publicTitle: "Leak check",
      payload: fixturePayload(),
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    await validateReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: 1,
    });
    const reviewed = await beginReview(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: 2,
    });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    await closeConversation(conversationId, 5);
    const published = await publishReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;

    const [reportImport, groups, findings] = await Promise.all([
      getReportImportById(db, published.value.importId),
      getReportGroupsByReportId(db, published.value.id),
      getReportImportById(db, published.value.importId),
    ]);
    expect(reportImport.ok && groups.ok && findings.ok).toBe(true);
    if (!reportImport.ok || !groups.ok || !reportImport.value) return;

    const dto = toPublicReportDto({
      report: published.value,
      reportImport: reportImport.value,
      groups: groups.value,
      findings: [],
    });
    expect(dto).not.toBeNull();
    if (!dto) return;
    expect(() => assertNoProtectedReportFieldLeak(dto)).not.toThrow();

    // Defense-in-depth: prove the assertion actually fires on a real leak.
    expect(() =>
      assertNoProtectedReportFieldLeak({
        ...dto,
        conversationId: "should-never-appear",
      } as unknown as object),
    ).toThrow(/PUBLIC_INPUT_REPORT_DTO_LEAK/);
  });
});
