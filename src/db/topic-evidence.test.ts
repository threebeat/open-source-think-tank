import { readFileSync } from "node:fs";
import path from "node:path";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  claimEvidenceLinks,
  claimReviews,
  closedTestConversations,
  conflictDisclosures,
  evidenceReviews,
  evidenceSubmissions,
  topics,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import {
  appendClaimReview,
  insertClaim,
  insertClaimEvidenceLink,
  listClaimReviews,
  updateClaimWorkflow,
} from "@/lib/claims/repository";
import {
  insertConflictDisclosure,
  toPublicConflictDisclosure,
} from "@/lib/conflicts/repository";
import {
  insertEvidenceSubmission,
  updateEvidenceQuality,
  updateEvidenceWorkflow,
} from "@/lib/evidence/repository";
import {
  getTopicBySlug,
  insertTopic,
  listTopics,
  updateTopicPublication,
  updateTopicWorkflow,
} from "@/lib/topics/repository";

describe("Phase 3.2 topic/claim/evidence model (PGlite)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previousMode: string | undefined;
  let previousDbUrl: string | undefined;

  beforeAll(async () => {
    previousMode = process.env.APP_MODE;
    previousDbUrl = process.env.DATABASE_URL;
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_topic_evidence";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client.close();
    if (previousMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = previousMode;
    }
    if (previousDbUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDbUrl;
    }
  });

  it("migrates cleanly and seeds synthetic topic/evidence rows", async () => {
    const topic = await getTopicBySlug(db, "ostt-synth-cedar-billing-ops");
    expect(topic.ok).toBe(true);
    if (!topic.ok) {
      return;
    }
    expect(topic.value?.synthetic).toBe(true);
    expect(topic.value?.publicationStatus).toBe("published");
    expect(topic.value?.workflowState).toBe("open_for_submissions");
  });

  it("enforces unique topic slugs and nonblank required text", async () => {
    await expect(
      db.insert(topics).values({
        id: "topic-ostt-synth-dup-slug",
        slug: "ostt-synth-cedar-billing-ops",
        title: "duplicate slug",
        question: "q",
        background: "b",
        scope: "s",
        createdByAccountId: "account-ostt-synth-staff-admin",
        synthetic: true,
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(topics).values({
        id: "topic-ostt-synth-blank-title",
        slug: "ostt-synth-blank-title",
        title: "   ",
        question: "q",
        background: "b",
        scope: "s",
        createdByAccountId: "account-ostt-synth-staff-admin",
        synthetic: true,
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid enum values and has no restored visibility", async () => {
    await expect(
      db.execute(sql`
        INSERT INTO topics (
          id, slug, title, question, background, scope,
          workflow_state, created_by_account_id, synthetic
        ) VALUES (
          'topic-ostt-synth-bad-enum',
          'ostt-synth-bad-enum',
          't', 'q', 'b', 's',
          'not_a_workflow',
          'account-ostt-synth-staff-admin',
          true
        )
      `),
    ).rejects.toThrow();

    const visibility = await db.execute(sql`
      SELECT e.enumlabel AS label
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'moderation_visibility'
      ORDER BY e.enumsortorder
    `);
    const labels = (visibility.rows as { label: string }[]).map(
      (row) => row.label,
    );
    expect(labels).toEqual(["visible", "held", "hidden"]);
    expect(labels).not.toContain("restored");
  });

  it("requires publication provenance and allows paused + published", async () => {
    await expect(
      db.insert(topics).values({
        id: "topic-ostt-synth-pub-missing",
        slug: "ostt-synth-pub-missing",
        title: "published without stamp",
        question: "q",
        background: "b",
        scope: "s",
        createdByAccountId: "account-ostt-synth-staff-admin",
        publicationStatus: "published",
        publishedAt: null,
        publishedByAccountId: null,
        synthetic: true,
      }),
    ).rejects.toThrow();

    const created = await insertTopic(db, {
      slug: "ostt-synth-paused-published",
      title: "Paused but published synthetic topic",
      question: "Can pause coexist with published?",
      background: "Synthetic independence check.",
      scope: "Schema drill",
      createdByAccountId: "account-ostt-synth-staff-admin",
      jurisdictionLevel: "statewide",
      stateCode: "TN",
      countyFips: null,
      synthetic: true,
      workflowState: "paused",
      publicationStatus: "published",
      publishedAt: new Date("2026-08-06T00:00:00.000Z"),
      publishedByAccountId: "account-ostt-synth-staff-admin",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.value.workflowState).toBe("paused");
    expect(created.value.publicationStatus).toBe("published");
  });

  it("workflow updates do not change publication status", async () => {
    const created = await insertTopic(db, {
      slug: "ostt-synth-workflow-only",
      title: "Workflow-only update topic",
      question: "q",
      background: "b",
      scope: "s",
      createdByAccountId: "account-ostt-synth-staff-admin",
      jurisdictionLevel: "statewide",
      stateCode: "TN",
      countyFips: null,
      synthetic: true,
      workflowState: "open_for_submissions",
      publicationStatus: "published",
      publishedAt: new Date("2026-08-06T12:00:00.000Z"),
      publishedByAccountId: "account-ostt-synth-staff-admin",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const updated = await updateTopicWorkflow(db, {
      topicId: created.value.id,
      expectedWorkflowState: "open_for_submissions",
      nextWorkflowState: "paused",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || !updated.value) {
      return;
    }
    expect(updated.value.workflowState).toBe("paused");
    expect(updated.value.publicationStatus).toBe("published");
    expect(updated.value.publishedByAccountId).toBe(
      "account-ostt-synth-staff-admin",
    );
  });

  it("enforces ownership foreign keys", async () => {
    await expect(
      db.insert(topics).values({
        id: "topic-ostt-synth-bad-owner",
        slug: "ostt-synth-bad-owner",
        title: "t",
        question: "q",
        background: "b",
        scope: "s",
        createdByAccountId: "account-ostt-synth-missing",
        synthetic: true,
      }),
    ).rejects.toThrow();
  });

  it("rejects cross-topic claim/evidence links and duplicate pairs", async () => {
    const topicA = await insertTopic(db, {
      slug: "ostt-synth-link-a",
      title: "Topic A",
      question: "q",
      background: "b",
      scope: "s",
      createdByAccountId: "account-ostt-synth-staff-admin",
      jurisdictionLevel: "statewide",
      stateCode: "TN",
      countyFips: null,
      synthetic: true,
    });
    const topicB = await insertTopic(db, {
      slug: "ostt-synth-link-b",
      title: "Topic B",
      question: "q",
      background: "b",
      scope: "s",
      createdByAccountId: "account-ostt-synth-staff-admin",
      jurisdictionLevel: "statewide",
      stateCode: "TN",
      countyFips: null,
      synthetic: true,
    });
    expect(topicA.ok && topicB.ok).toBe(true);
    if (!topicA.ok || !topicB.ok) {
      return;
    }

    const claimA = await insertClaim(db, {
      topicId: topicA.value.id,
      authorAccountId: "account-ostt-synth-ada",
      title: "Claim on A",
      summary: "summary",
      approachLabel: "approach",
      synthetic: true,
    });
    const evidenceB = await insertEvidenceSubmission(db, {
      topicId: topicB.value.id,
      submitterAccountId: "account-ostt-synth-ada",
      sourceUrl: "https://example.ostt.synth.test/cross",
      title: "Evidence on B",
      organization: "ostt-synth org",
      authorType: "other",
      sourceType: "other",
      limitations: "synthetic only",
      synthetic: true,
    });
    expect(claimA.ok && evidenceB.ok).toBe(true);
    if (!claimA.ok || !evidenceB.ok) {
      return;
    }

    await expect(
      insertClaimEvidenceLink(db, {
        topicId: topicA.value.id,
        claimId: claimA.value.id,
        evidenceSubmissionId: evidenceB.value.id,
        relationship: "supporting",
      }),
    ).rejects.toThrow();

    const evidenceA = await insertEvidenceSubmission(db, {
      topicId: topicA.value.id,
      submitterAccountId: "account-ostt-synth-ada",
      sourceUrl: "https://example.ostt.synth.test/same",
      title: "Evidence on A",
      organization: "ostt-synth org",
      authorType: "other",
      sourceType: "other",
      limitations: "synthetic only",
      synthetic: true,
    });
    expect(evidenceA.ok).toBe(true);
    if (!evidenceA.ok) {
      return;
    }

    const linked = await insertClaimEvidenceLink(db, {
      topicId: topicA.value.id,
      claimId: claimA.value.id,
      evidenceSubmissionId: evidenceA.value.id,
      relationship: "supporting",
    });
    expect(linked.ok).toBe(true);

    await expect(
      db.insert(claimEvidenceLinks).values({
        id: "celink-ostt-synth-dup",
        topicId: topicA.value.id,
        claimId: claimA.value.id,
        evidenceSubmissionId: evidenceA.value.id,
        relationship: "counterevidence",
      }),
    ).rejects.toThrow();
  });

  it("requires exactly one conflict-disclosure subject", async () => {
    const claimId = "claim-ostt-synth-billing-timeline";
    const evidenceId = "evsub-ostt-synth-billing-memo";

    const none = await insertConflictDisclosure(db, {
      disclosingAccountId: "account-ostt-synth-ada",
      publicSummary: "missing subject",
      synthetic: true,
    });
    expect(none.ok).toBe(false);

    await expect(
      db.insert(conflictDisclosures).values({
        id: "cdisc-ostt-synth-both",
        disclosingAccountId: "account-ostt-synth-ada",
        claimId,
        evidenceSubmissionId: evidenceId,
        publicSummary: "both subjects",
        synthetic: true,
      }),
    ).rejects.toThrow();

    const publicProjection = toPublicConflictDisclosure({
      id: "x",
      disclosingAccountId: "account-ostt-synth-ada",
      claimId,
      evidenceSubmissionId: null,
      publicSummary: "public",
      privateDetail: "secret",
      synthetic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(publicProjection).not.toHaveProperty("privateDetail");
    expect(publicProjection).not.toHaveProperty("disclosingAccountId");
  });

  it("keeps evidence quality independent from submission workflow", async () => {
    const topic = await insertTopic(db, {
      slug: "ostt-synth-quality-indep",
      title: "Quality independence",
      question: "q",
      background: "b",
      scope: "s",
      createdByAccountId: "account-ostt-synth-staff-admin",
      jurisdictionLevel: "statewide",
      stateCode: "TN",
      countyFips: null,
      synthetic: true,
    });
    expect(topic.ok).toBe(true);
    if (!topic.ok) {
      return;
    }

    const evidence = await insertEvidenceSubmission(db, {
      topicId: topic.value.id,
      submitterAccountId: "account-ostt-synth-ada",
      sourceUrl: "https://example.ostt.synth.test/quality",
      title: "Quality row",
      organization: "ostt-synth org",
      authorType: "researcher",
      sourceType: "report",
      limitations: "synthetic",
      synthetic: true,
      workflowState: "submitted",
      qualityStatus: "pending",
    });
    expect(evidence.ok).toBe(true);
    if (!evidence.ok) {
      return;
    }

    const workflow = await updateEvidenceWorkflow(db, {
      evidenceSubmissionId: evidence.value.id,
      expectedWorkflowState: "submitted",
      nextWorkflowState: "accepted",
    });
    expect(workflow.ok && workflow.value?.qualityStatus).toBe("pending");
    expect(workflow.ok && workflow.value?.workflowState).toBe("accepted");

    const quality = await updateEvidenceQuality(db, {
      evidenceSubmissionId: evidence.value.id,
      expectedQualityStatus: "pending",
      nextQualityStatus: "disputed",
    });
    expect(quality.ok && quality.value?.workflowState).toBe("accepted");
    expect(quality.ok && quality.value?.qualityStatus).toBe("disputed");
  });

  it("protects review records from silent overwrite/deletion", async () => {
    const review = await appendClaimReview(db, {
      claimId: "claim-ostt-synth-billing-timeline",
      reviewerAccountId: "account-ostt-synth-staff-admin",
      decision: "accepted",
      publicRationale: "Synthetic append-only acceptance note.",
      synthetic: true,
    });
    expect(review.ok).toBe(true);
    if (!review.ok) {
      return;
    }

    await expect(
      db
        .update(claimReviews)
        .set({ publicRationale: "overwrite" })
        .where(eq(claimReviews.id, review.value.id)),
    ).rejects.toThrow(/immutable|Failed query/i);

    await expect(
      db.delete(claimReviews).where(eq(claimReviews.id, review.value.id)),
    ).rejects.toThrow(/immutable|Failed query/i);

    await expect(
      db
        .update(evidenceReviews)
        .set({ publicRationale: "overwrite" })
        .where(eq(evidenceReviews.id, "erev-ostt-synth-evidence-pending")),
    ).rejects.toThrow(/immutable|Failed query/i);

    const [stillThere] = await db
      .select()
      .from(claimReviews)
      .where(eq(claimReviews.id, review.value.id));
    expect(stillThere?.publicRationale).toBe(
      "Synthetic append-only acceptance note.",
    );

    const history = await listClaimReviews(
      db,
      "claim-ostt-synth-billing-timeline",
    );
    expect(history.ok).toBe(true);
    if (history.ok) {
      expect(history.value.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("preserves synthetic-only closed_test_conversations protection", async () => {
    await expect(
      db.insert(closedTestConversations).values({
        id: "ostt-synth-conversation-realish",
        label: "must fail",
        purpose: "closed_test_consultation",
        status: "open",
        synthetic: false,
      }),
    ).rejects.toThrow();
  });

  it("lists topics by workflow/publication and claims by topic filters", async () => {
    const published = await listTopics(db, {
      publicationStatus: "published",
    });
    expect(published.ok).toBe(true);
    if (published.ok) {
      expect(published.value.length).toBeGreaterThan(0);
      expect(
        published.value.every((row) => row.publicationStatus === "published"),
      ).toBe(true);
    }

    const claimWorkflow = await updateClaimWorkflow(db, {
      claimId: "claim-ostt-synth-billing-timeline",
      expectedWorkflowState: "submitted",
      nextWorkflowState: "changes_requested",
    });
    expect(claimWorkflow.ok && claimWorkflow.value?.workflowState).toBe(
      "changes_requested",
    );
  });

  it("publication expected-state update does not alter workflow", async () => {
    const created = await insertTopic(db, {
      slug: "ostt-synth-pub-only",
      title: "Publication-only update",
      question: "q",
      background: "b",
      scope: "s",
      createdByAccountId: "account-ostt-synth-staff-admin",
      jurisdictionLevel: "statewide",
      stateCode: "TN",
      countyFips: null,
      synthetic: true,
      workflowState: "under_review",
      publicationStatus: "unpublished",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const published = await updateTopicPublication(db, {
      topicId: created.value.id,
      expectedPublicationStatus: "unpublished",
      nextPublicationStatus: "published",
      publishedAt: new Date("2026-08-07T00:00:00.000Z"),
      publishedByAccountId: "account-ostt-synth-staff-admin",
    });
    expect(published.ok && published.value?.workflowState).toBe("under_review");
    expect(published.ok && published.value?.publicationStatus).toBe(
      "published",
    );
  });

  it("repository modules do not import fixture catalog", () => {
    const roots = [
      "src/lib/topics/repository.ts",
      "src/lib/claims/repository.ts",
      "src/lib/evidence/repository.ts",
      "src/lib/conflicts/repository.ts",
      "src/lib/persistence/gated.ts",
    ];
    for (const rel of roots) {
      const source = readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(source).not.toMatch(/@\/fixtures|fixtureCatalog/);
    }
  });

  it("seed evidence review does not require matching current quality row", async () => {
    const [row] = await db
      .select()
      .from(evidenceSubmissions)
      .where(eq(evidenceSubmissions.id, "evsub-ostt-synth-billing-memo"));
    expect(row?.workflowState).toBe("submitted");
    expect(row?.qualityStatus).toBe("pending");

    const [review] = await db
      .select()
      .from(evidenceReviews)
      .where(eq(evidenceReviews.id, "erev-ostt-synth-evidence-pending"));
    expect(review?.qualityStatus).toBe("limited");
    expect(review?.decision).toBe("quality_decided");
  });

  it("claim and evidence tables exist after empty-database migration", async () => {
    const counts = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM topics) AS topics,
        (SELECT count(*)::int FROM claims) AS claims,
        (SELECT count(*)::int FROM evidence_submissions) AS evidence,
        (SELECT count(*)::int FROM claim_evidence_links) AS links,
        (SELECT count(*)::int FROM conflict_disclosures) AS disclosures,
        (SELECT count(*)::int FROM claim_reviews) AS claim_reviews,
        (SELECT count(*)::int FROM evidence_reviews) AS evidence_reviews
    `);
    const row = counts.rows[0] as Record<string, number>;
    expect(row.topics).toBeGreaterThan(0);
    expect(row.claims).toBeGreaterThan(0);
    expect(row.evidence).toBeGreaterThan(0);
    expect(row.links).toBeGreaterThan(0);
    expect(row.disclosures).toBeGreaterThan(0);
    expect(row.claim_reviews).toBeGreaterThan(0);
    expect(row.evidence_reviews).toBeGreaterThan(0);
  });
});
