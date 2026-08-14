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
import { getReportFindingsByReportId } from "@/lib/public-input/reports/repository";
import {
  beginReview,
  getPublishedReportForTopic,
  getStaffReportDetail,
  importAggregateReport,
  publishReport,
  validateReport,
} from "@/lib/public-input/reports/service";
import {
  decideFindingPublication,
  recordProviderModeration,
} from "@/lib/public-input/moderation/service";

const ADMIN = "account-ostt-synth-staff-admin";
const MODERATOR = "account-ostt-synth-staff-moderator";
const PARTICIPANT = "account-ostt-synth-ada";

describe("Public Input moderation service (4.5A)", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_public_input_moderation";

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
      slug: `pinmod-fixture-topic-${topicCounter}`,
      title: `Public Input moderation fixture topic ${topicCounter}`,
      question: "What should change?",
      background: "Background for a Public Input moderation fixture topic.",
      scope: "Alpha test scope.",
      jurisdictionLevel: "statewide",
      countyFips: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("failed to create fixture topic");
    return created.value.id;
  }

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
    for (const action of [
      "mark_ready",
      "open",
      "close_commenting",
      "close_voting",
    ] as const) {
      const result = await transitionConversation(db, {
        actorAccountId: ADMIN,
        conversationId,
        action,
        expectedWorkflowState: state,
        expectedVersion: version,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(`failed transition ${action}`);
      version = result.value.version;
      state = result.value.workflowState;
    }
    return conversationId;
  }

  function fixturePayload() {
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
        { label: "Group A", participantCount: 60 },
        { label: "Group B", participantCount: 40 },
      ],
      crossGroupAgreement: ["Most participants agreed on statement one."],
      meaningfulDisagreement: ["Participants disagreed on statement two."],
    };
  }

  async function importThroughUnderReview(conversationId: string) {
    const imported = await importAggregateReport(db, {
      actorAccountId: ADMIN,
      conversationId,
      payload: fixturePayload(),
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

  it("records provider-side moderation for moderators and administrators, but denies participants", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);

    const deniedForParticipant = await recordProviderModeration(db, {
      actorAccountId: PARTICIPANT,
      conversationId,
      opaqueStatementRef: "opaque-fingerprint-001",
      status: "pending",
      reasonCode: "provider_export_flagged",
    });
    expect(deniedForParticipant.ok).toBe(false);
    if (!deniedForParticipant.ok) {
      expect(["AUTHZ_DENIED", "AUTHZ_ACTIVE_REQUIRED"]).toContain(
        deniedForParticipant.code,
      );
    }

    const byModerator = await recordProviderModeration(db, {
      actorAccountId: MODERATOR,
      conversationId,
      opaqueStatementRef: "opaque-fingerprint-001",
      status: "pending",
      reasonCode: "provider_export_flagged",
      privateNote: "Awaiting provider-side review.",
    });
    expect(byModerator.ok).toBe(true);
    if (!byModerator.ok) return;
    expect(byModerator.value.status).toBe("pending");
    expect(byModerator.value.opaqueStatementRef).toBe(
      "opaque-fingerprint-001",
    );

    const byAdmin = await recordProviderModeration(db, {
      actorAccountId: ADMIN,
      conversationId,
      opaqueStatementRef: "opaque-fingerprint-001",
      status: "accepted",
      reasonCode: "provider_export_cleared",
    });
    expect(byAdmin.ok).toBe(true);
    if (!byAdmin.ok) return;
    expect(byAdmin.value.id).toBe(byModerator.value.id);
    expect(byAdmin.value.status).toBe("accepted");

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectId, byAdmin.value.id),
          eq(auditEvents.action, "consultations.moderation.provider_recorded"),
        ),
      )
      .orderBy(auditEvents.createdAt);
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit)).not.toContain("opaque-fingerprint-001");
  });

  it("never stores rejected provider statement text — only an opaque ref and reason code", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);

    const recorded = await recordProviderModeration(db, {
      actorAccountId: MODERATOR,
      conversationId,
      opaqueStatementRef: "opaque-fingerprint-rejected",
      status: "rejected",
      reasonCode: "off_topic",
      privateNote: "Flagged as off-topic by provider moderation queue.",
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(recorded.value.status).toBe("rejected");
    expect(Object.keys(recorded.value)).not.toContain("statementText");
  });

  it("requires under_review + expectedConcurrencyVersion to decide finding publication and denies moderators", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);
    const { imported, reviewed } =
      await importThroughUnderReview(conversationId);

    const findings = await getReportFindingsByReportId(
      db,
      imported.value.reportId,
    );
    expect(findings.ok).toBe(true);
    if (!findings.ok) return;
    const disagreementFinding = findings.value.find(
      (f) => f.kind === "meaningful_disagreement",
    );
    expect(disagreementFinding).toBeTruthy();
    if (!disagreementFinding) return;

    const deniedForModerator = await decideFindingPublication(db, {
      actorAccountId: MODERATOR,
      reportId: imported.value.reportId,
      findingId: disagreementFinding.id,
      action: "withhold",
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
      publicRationale:
        "Statement duplicates another finding already reported.",
    });
    expect(deniedForModerator.ok).toBe(false);
    if (!deniedForModerator.ok) {
      expect(deniedForModerator.code).toBe("AUTHZ_DENIED");
    }

    const missingRationale = await decideFindingPublication(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      findingId: disagreementFinding.id,
      action: "withhold",
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
      publicRationale: "no",
    });
    expect(missingRationale.ok).toBe(false);
    if (!missingRationale.ok) {
      expect(missingRationale.code).toBe(
        "FINDING_DECISION_RATIONALE_REQUIRED",
      );
    }

    const withheld = await decideFindingPublication(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      findingId: disagreementFinding.id,
      action: "withhold",
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
      publicRationale:
        "Statement duplicates another finding already reported.",
      privateNote: "Internal note only.",
    });
    expect(withheld.ok).toBe(true);
    if (!withheld.ok) return;
    expect(withheld.value.publicationStatus).toBe("withheld");

    const staffAfterWithhold = await getStaffReportDetail(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
    });
    expect(staffAfterWithhold.ok).toBe(true);
    if (!staffAfterWithhold.ok || !staffAfterWithhold.value) return;
    expect(staffAfterWithhold.value.concurrencyVersion).toBe(
      reviewed.value.concurrencyVersion + 1,
    );

    const [auditRow] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectId, disagreementFinding.id),
          eq(auditEvents.action, "consultations.reports.finding_withheld"),
        ),
      );
    expect(auditRow).toBeTruthy();
    expect(JSON.stringify(auditRow)).not.toContain("Internal note only");

    const reincluded = await decideFindingPublication(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      findingId: disagreementFinding.id,
      action: "include",
      expectedConcurrencyVersion: staffAfterWithhold.value.concurrencyVersion,
    });
    expect(reincluded.ok).toBe(true);
    if (!reincluded.ok) return;
    expect(reincluded.value.publicationStatus).toBe("included");
  });

  it("logs a distinct consultations.reports.finding_superseded audit action for supersede_finding (never finding_withheld)", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);
    const { imported, reviewed } =
      await importThroughUnderReview(conversationId);

    const findings = await getReportFindingsByReportId(
      db,
      imported.value.reportId,
    );
    expect(findings.ok).toBe(true);
    if (!findings.ok) return;
    const agreementFinding = findings.value.find(
      (f) => f.kind === "cross_group_agreement",
    );
    expect(agreementFinding).toBeTruthy();
    if (!agreementFinding) return;

    const superseded = await decideFindingPublication(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      findingId: agreementFinding.id,
      action: "supersede_finding",
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
      publicRationale:
        "Replaced by an updated cross-group agreement finding in a newer import.",
    });
    expect(superseded.ok).toBe(true);
    if (!superseded.ok) return;
    expect(superseded.value.publicationStatus).toBe("superseded");

    const [supersededAudit] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectId, agreementFinding.id),
          eq(auditEvents.action, "consultations.reports.finding_superseded"),
        ),
      );
    expect(supersededAudit).toBeTruthy();

    const [misclassifiedAudit] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectId, agreementFinding.id),
          eq(auditEvents.action, "consultations.reports.finding_withheld"),
        ),
      );
    expect(misclassifiedAudit).toBeUndefined();
  });

  it("denies finding publication decisions after the report is published", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);
    const { imported, reviewed } =
      await importThroughUnderReview(conversationId);

    await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId,
      action: "close",
      expectedWorkflowState: "voting_closed",
      expectedVersion: 5,
      reason: "Voting window elapsed; closing consultation for reporting.",
    });

    const published = await publishReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;

    const findings = await getReportFindingsByReportId(
      db,
      imported.value.reportId,
    );
    expect(findings.ok).toBe(true);
    if (!findings.ok) return;
    const finding = findings.value[0];
    expect(finding).toBeTruthy();
    if (!finding) return;

    const denied = await decideFindingPublication(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      findingId: finding.id,
      action: "withhold",
      expectedConcurrencyVersion: published.value.concurrencyVersion,
      publicRationale: "Attempted post-publish mutation must fail closed.",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe("PUBLIC_INPUT_REPORT_NOT_UNDER_REVIEW");
    }
  });

  it("excludes withheld findings from the published public projection", async () => {
    const topicId = await freshTopicId();
    const conversationId = await freshVotingClosedConversationId(topicId);
    const { imported, reviewed } =
      await importThroughUnderReview(conversationId);

    const findings = await getReportFindingsByReportId(
      db,
      imported.value.reportId,
    );
    expect(findings.ok).toBe(true);
    if (!findings.ok) return;
    const agreementFinding = findings.value.find(
      (f) => f.kind === "cross_group_agreement",
    );
    expect(agreementFinding).toBeTruthy();
    if (!agreementFinding) return;

    const withheld = await decideFindingPublication(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      findingId: agreementFinding.id,
      action: "withhold",
      expectedConcurrencyVersion: reviewed.value.concurrencyVersion,
      publicRationale: "Statement text failed institutional review.",
    });
    expect(withheld.ok).toBe(true);

    const staffAfter = await getStaffReportDetail(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
    });
    expect(staffAfter.ok).toBe(true);
    if (!staffAfter.ok || !staffAfter.value) return;

    await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId,
      action: "close",
      expectedWorkflowState: "voting_closed",
      expectedVersion: 5,
      reason: "Voting window elapsed; closing consultation for reporting.",
    });

    const published = await publishReport(db, {
      actorAccountId: ADMIN,
      reportId: imported.value.reportId,
      expectedConcurrencyVersion: staffAfter.value.concurrencyVersion,
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;

    const dto = await getPublishedReportForTopic(db, topicId);
    expect(dto.ok).toBe(true);
    if (!dto.ok || !dto.value) return;
    expect(dto.value.crossGroupAgreement).toEqual([]);
    expect(dto.value.meaningfulDisagreement).toEqual([
      "Participants disagreed on statement two.",
    ]);
  });
});
