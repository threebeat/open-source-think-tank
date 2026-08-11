import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { accounts, auditEvents, topics } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { reviewClaim } from "@/lib/claims/review";
import {
  decideEvidenceQuality,
  reviewEvidenceWorkflow,
} from "@/lib/evidence/review";
import { createAndSubmitClaimEvidence } from "@/lib/submissions/submit";
import {
  createTopic,
  transitionTopic,
} from "@/lib/topics/authoring";
import { getPublishedTopicProjection } from "@/lib/topics/gated-public-read";
import {
  evaluatePublishReadiness,
  publishTopic,
} from "@/lib/topics/publish";
import { projectionContainsForbiddenKeys } from "@/lib/topics/public-projection";
import { seedApprovedAssertions } from "@/lib/verification/seed-assurance";

const ADMIN = "account-ostt-synth-staff-admin";
const PARTICIPANT = "account-ostt-synth-ada";

describe("publish readiness and projection (3.6)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previousMode: string | undefined;
  let previousDbUrl: string | undefined;
  let topicId: string;
  let topicSlug: string;

  beforeAll(async () => {
    previousMode = process.env.APP_MODE;
    previousDbUrl = process.env.DATABASE_URL;
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_publish";

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
      slug: "publish-ready-topic",
      title: "Publish ready topic",
      question: "Should this be published?",
      background: "Background for publish tests.",
      scope: "Scope for publish tests.",
      jurisdictionLevel: "statewide",
      countyFips: null,
    });
    expect(topic.ok).toBe(true);
    if (!topic.ok) throw new Error("create failed");
    topicId = topic.value.id;
    topicSlug = topic.value.slug;

    const opened = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId,
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

  it("readiness rejects open_for_submissions without accepted set", async () => {
    const readiness = await evaluatePublishReadiness(db, topicId);
    expect(readiness.ok).toBe(true);
    if (!readiness.ok) return;
    expect(readiness.value.ready).toBe(false);
    expect(
      readiness.value.blockers.some(
        (b) => b.code === "WORKFLOW_NOT_UNDER_REVIEW",
      ),
    ).toBe(true);
  });

  it("publishes atomically after review and preserves workflow on pause", async () => {
    const submitted = await createAndSubmitClaimEvidence(db, {
      actorAccountId: PARTICIPANT,
      topicId,
      claimTitle: "Publishable claim",
      claimSummary: "A coherent claim summary for publication.",
      approachLabel: "Transparency",
      sourceUrl: "https://example.ostt.synth.test/publish-memo",
      evidenceTitle: "Publish memo",
      organization: "Desk",
      authorType: "agency",
      sourceType: "memo",
      limitations: "Synthetic limitations for publish path.",
      relationship: "supporting",
      disclosureChoice: "none",
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) throw new Error("submit failed");

    const begin = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId,
      action: "begin_review",
      expectedWorkflowState: "open_for_submissions",
      reason: "Begin review for publication readiness.",
    });
    expect(begin.ok).toBe(true);

    const claimAccepted = await reviewClaim(db, {
      actorAccountId: ADMIN,
      claimId: submitted.value.claim.id,
      decision: "accepted",
      publicRationale: "Claim accepted with clear limitations context.",
      expectedWorkflowState: "submitted",
    });
    expect(claimAccepted.ok).toBe(true);

    const evidenceAccepted = await reviewEvidenceWorkflow(db, {
      actorAccountId: ADMIN,
      evidenceSubmissionId: submitted.value.evidence.id,
      decision: "accepted",
      publicRationale: "Evidence workflow accepted for publication.",
      expectedWorkflowState: "submitted",
    });
    expect(evidenceAccepted.ok).toBe(true);

    const quality = await decideEvidenceQuality(db, {
      actorAccountId: ADMIN,
      evidenceSubmissionId: submitted.value.evidence.id,
      qualityStatus: "limited",
      publicRationale: "Quality limited but suitable for alpha publication.",
      expectedQualityStatus: "pending",
    });
    expect(quality.ok).toBe(true);

    const readiness = await evaluatePublishReadiness(db, topicId);
    expect(readiness.ok).toBe(true);
    if (!readiness.ok) return;
    expect(readiness.value.ready).toBe(true);

    const published = await publishTopic(db, {
      actorAccountId: ADMIN,
      topicId,
      expectedPublicationStatus: "unpublished",
    });
    expect(published.ok).toBe(true);
    if (!published.ok) throw new Error("publish failed");
    expect(published.value.publicationStatus).toBe("published");
    expect(published.value.workflowState).toBe("under_review");
    expect(published.value.publishedByAccountId).toBe(ADMIN);

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "topics.published"))
      .limit(1);
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit.privatePayload)).not.toContain(
      "Claim accepted",
    );

    const projection = await getPublishedTopicProjection(db, topicSlug);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value).not.toBeNull();
    expect(projectionContainsForbiddenKeys(projection.value)).toEqual([]);
    expect(JSON.stringify(projection.value)).not.toContain(ADMIN);
    expect(JSON.stringify(projection.value)).not.toContain("private");

    const unpublished = await getPublishedTopicProjection(
      db,
      "does-not-exist-slug",
    );
    expect(unpublished.ok).toBe(true);
    if (unpublished.ok) {
      expect(unpublished.value).toBeNull();
    }

    const paused = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId,
      action: "pause",
      expectedWorkflowState: "under_review",
      reason: "Pause should not unpublish.",
    });
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.value.publicationStatus).toBe("published");
    expect(paused.value.workflowState).toBe("paused");

    const [row] = await db.select().from(topics).where(eq(topics.id, topicId));
    expect(row?.publicationStatus).toBe("published");
  });

  it("denies participant publish", async () => {
    const denied = await publishTopic(db, {
      actorAccountId: PARTICIPANT,
      topicId,
      expectedPublicationStatus: "unpublished",
    });
    expect(denied.ok).toBe(false);
  });
});
