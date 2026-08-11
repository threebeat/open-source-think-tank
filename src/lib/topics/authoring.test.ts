import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { auditEvents, roleAssignments } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { isRegisteredAuditAction } from "@/lib/audit/registry";
import {
  createTopic,
  transitionTopic,
  updateDraftTopicMetadata,
} from "@/lib/topics/authoring";
import {
  getTopicById,
  updateTopicPublication,
} from "@/lib/topics/repository";

const ADMIN = "account-ostt-synth-staff-admin";
const PARTICIPANT = "account-ostt-synth-ada";

describe("topic authoring services (3.4)", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_topic_authoring";

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

  it("registers 3.4 topic audit actions without public projectors", () => {
    for (const action of [
      "topics.created",
      "topics.updated",
      "topics.opened",
      "topics.review_started",
      "topics.reopened",
      "topics.paused",
      "topics.archived",
    ]) {
      expect(isRegisteredAuditAction(action)).toBe(true);
    }
    expect(isRegisteredAuditAction("topics.published")).toBe(false);
  });

  it("creates draft unpublished topics from the principal", async () => {
    const created = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "alpha-billing-ops-draft",
      title: "Alpha billing ops",
      question: "What should change?",
      background: "Background for the draft.",
      scope: "Alpha test scope.",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value.workflowState).toBe("draft");
    expect(created.value.publicationStatus).toBe("unpublished");
    expect(created.value.publishedAt).toBeNull();
    expect(created.value.publishedByAccountId).toBeNull();
    expect(created.value.createdByAccountId).toBe(ADMIN);
    expect(created.value.synthetic).toBe(true);

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.subjectId, created.value.id));
    expect(audit?.action).toBe("topics.created");
    expect(JSON.stringify(audit)).not.toContain(created.value.background);
  });

  it("denies create for non-administrators", async () => {
    const denied = await createTopic(db, {
      actorAccountId: PARTICIPANT,
      slug: "participant-cannot-create",
      title: "Nope",
      question: "Nope?",
      background: "Nope",
      scope: "Nope",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toMatch(/AUTHZ_/);
    }
  });

  it("rejects invalid slugs and duplicate slugs safely", async () => {
    const bad = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "Bad Slug!",
      title: "t",
      question: "q",
      background: "b",
      scope: "s",
    });
    expect(bad.ok).toBe(false);

    const first = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "unique-slug-once",
      title: "One",
      question: "Q",
      background: "B",
      scope: "S",
    });
    expect(first.ok).toBe(true);
    const dup = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "unique-slug-once",
      title: "Two",
      question: "Q",
      background: "B",
      scope: "S",
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.code).toBe("TOPIC_SLUG_CONFLICT");
      expect(dup.error).not.toMatch(/draft|background/i);
    }
  });

  it("follows the allowed transition table and rejects unlisted paths", async () => {
    const created = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "transition-table-demo",
      title: "Transitions",
      question: "How do transitions work?",
      background: "Background",
      scope: "Scope",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;

    const skipReview = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: id,
      action: "begin_review",
      expectedWorkflowState: "draft",
      reason: "Should not jump draft to review",
    });
    expect(skipReview.ok).toBe(false);

    const opened = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: id,
      action: "open",
      expectedWorkflowState: "draft",
    });
    expect(opened.ok).toBe(true);

    const reviewNoReason = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: id,
      action: "begin_review",
      expectedWorkflowState: "open_for_submissions",
    });
    expect(reviewNoReason.ok).toBe(false);

    const review = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: id,
      action: "begin_review",
      expectedWorkflowState: "open_for_submissions",
      reason: "Begin staff review of submissions.",
    });
    expect(review.ok).toBe(true);
    if (!review.ok) return;

    const reopen = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: id,
      action: "reopen",
      expectedWorkflowState: "under_review",
      reason: "Need more submissions before closing.",
    });
    expect(reopen.ok).toBe(true);

    const paused = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: id,
      action: "pause",
      expectedWorkflowState: "open_for_submissions",
      reason: "Pause while clarifying scope.",
    });
    expect(paused.ok).toBe(true);

    const fromPausedToReview = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: id,
      action: "begin_review",
      expectedWorkflowState: "paused",
      reason: "Not allowed directly from paused.",
    });
    expect(fromPausedToReview.ok).toBe(false);

    const reopened = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: id,
      action: "reopen",
      expectedWorkflowState: "paused",
      reason: "Resume submissions after clarification.",
    });
    expect(reopened.ok).toBe(true);

    const archived = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: id,
      action: "archive",
      expectedWorkflowState: "open_for_submissions",
      reason: "Archive completed alpha topic.",
    });
    expect(archived.ok).toBe(true);

    const afterArchive = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: id,
      action: "open",
      expectedWorkflowState: "archived",
    });
    expect(afterArchive.ok).toBe(false);
  });

  it("preserves publication when pausing or archiving a published topic", async () => {
    const created = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "published-pause-demo",
      title: "Published pause",
      question: "Q",
      background: "B",
      scope: "S",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: created.value.id,
      action: "open",
      expectedWorkflowState: "draft",
    });

    const published = await updateTopicPublication(db, {
      topicId: created.value.id,
      expectedPublicationStatus: "unpublished",
      nextPublicationStatus: "published",
      publishedAt: new Date("2026-08-01T00:00:00.000Z"),
      publishedByAccountId: ADMIN,
    });
    expect(published.ok && published.value).toBeTruthy();

    const paused = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: created.value.id,
      action: "pause",
      expectedWorkflowState: "open_for_submissions",
      reason: "Operational pause must not unpublish.",
    });
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.value.publicationStatus).toBe("published");
    expect(paused.value.publishedByAccountId).toBe(ADMIN);

    const archived = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: created.value.id,
      action: "archive",
      expectedWorkflowState: "paused",
      reason: "Archive while remaining published.",
    });
    expect(archived.ok).toBe(true);
    if (!archived.ok) return;
    expect(archived.value.publicationStatus).toBe("published");
    expect(archived.value.workflowState).toBe("archived");
  });

  it("rejects stale expected-state transitions without emitting audit", async () => {
    const created = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "stale-write-demo",
      title: "Stale",
      question: "Q",
      background: "B",
      scope: "S",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const [first, second] = await Promise.all([
      transitionTopic(db, {
        actorAccountId: ADMIN,
        topicId: created.value.id,
        action: "open",
        expectedWorkflowState: "draft",
      }),
      transitionTopic(db, {
        actorAccountId: ADMIN,
        topicId: created.value.id,
        action: "open",
        expectedWorkflowState: "draft",
      }),
    ]);
    expect([first, second].filter((row) => row.ok)).toHaveLength(1);
    expect([first, second].some((row) => !row.ok)).toBe(true);

    const audits = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectId, created.value.id),
          eq(auditEvents.action, "topics.opened"),
        ),
      );
    expect(audits).toHaveLength(1);
  });

  it("updates draft metadata without changing workflow or publication", async () => {
    const created = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "metadata-edit-demo",
      title: "Before",
      question: "Before?",
      background: "Before background",
      scope: "Before scope",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateDraftTopicMetadata(db, {
      actorAccountId: ADMIN,
      topicId: created.value.id,
      title: "After",
      question: "After?",
      background: "After background",
      scope: "After scope",
      expectedUpdatedAt: created.value.updatedAt.toISOString(),
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.title).toBe("After");
    expect(updated.value.workflowState).toBe("draft");
    expect(updated.value.publicationStatus).toBe("unpublished");

    await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: created.value.id,
      action: "open",
      expectedWorkflowState: "draft",
    });
    const blocked = await updateDraftTopicMetadata(db, {
      actorAccountId: ADMIN,
      topicId: created.value.id,
      title: "Nope",
      question: "Nope",
      background: "Nope",
      scope: "Nope",
      expectedUpdatedAt: updated.value.updatedAt.toISOString(),
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe("TOPIC_METADATA_DRAFT_ONLY");
    }
  });

  it("does not invent a publish path in authoring services", async () => {
    expect(
      Object.keys(
        await import("@/lib/topics/authoring"),
      ).some((key) => /publish/i.test(key)),
    ).toBe(false);
    const topic = await getTopicById(db, "topic-ostt-synth-cedar-billing");
    expect(topic.ok).toBe(true);
  });

  it("keeps administrator grant distinct from participant in seed", async () => {
    const adminRoles = await db
      .select()
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.accountId, ADMIN),
          eq(roleAssignments.role, "administrator"),
          isNull(roleAssignments.revokedAt),
        ),
      );
    expect(adminRoles.length).toBeGreaterThan(0);
  });
});
