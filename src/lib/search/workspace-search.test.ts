import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { accounts, persons, roleAssignments } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { newEntityId } from "@/lib/auth/tokens";
import { insertClaim } from "@/lib/claims/repository";
import {
  escapeIlikePattern,
  ilikeContainsPattern,
  workspaceSearchQuerySchema,
  WORKSPACE_SEARCH_QUERY_MAX,
  WORKSPACE_SEARCH_QUERY_MIN,
} from "@/lib/search/schemas";
import {
  searchWorkspace,
  WORKSPACE_SEARCH_FORBIDDEN_KEYS,
} from "@/lib/search/workspace-search";
import { createTopic, transitionTopic } from "@/lib/topics/authoring";
import { L3_KINDS, seedApprovedAssertions } from "@/lib/verification/seed-assurance";

const ADA = "account-ostt-synth-ada";
const BEN = "account-ostt-synth-ben";
const ADMIN = "account-ostt-synth-staff-admin";
const MODERATOR = "account-ostt-synth-staff-moderator";
const REVIEWER = "account-ostt-synth-search-reviewer";
const AUDITOR = "account-ostt-synth-search-auditor";
const MULTI = "account-ostt-synth-search-multi";
const MULTI_MOD = "account-ostt-synth-search-multi-mod";
const CEDAR_TOPIC = "topic-ostt-synth-cedar-billing";

async function insertActiveAccount(
  db: Awaited<ReturnType<typeof createTestDatabase>>["db"],
  id: string,
  roles: Array<"participant" | "reviewer" | "moderator" | "administrator" | "auditor">,
) {
  const personId = newEntityId("person");
  await db.insert(persons).values({
    id: personId,
    synthetic: true,
    displayLabel: `ostt-synth ${id}`,
  });
  await db.insert(accounts).values({
    id,
    personId,
    contactChannel: `${id}@ostt.synth.test`,
    lifecycleState: "active",
    synthetic: true,
    contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    activatedAt: new Date("2026-08-02T00:00:00.000Z"),
  });
  for (const role of roles) {
    await db.insert(roleAssignments).values({
      id: newEntityId("role"),
      accountId: id,
      role,
      grantedByLabel: "ostt-synth-search-test",
      reason: "Workspace search ACL fixture.",
    });
  }
  await seedApprovedAssertions(db, id, L3_KINDS);
}

describe("workspace search (3.11)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previousMode: string | undefined;
  let previousDbUrl: string | undefined;
  let openTopicId: string;
  let foreignDraftTitle: string;
  let wildcardTitle: string;

  beforeAll(async () => {
    previousMode = process.env.APP_MODE;
    previousDbUrl = process.env.DATABASE_URL;
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_workspace_search";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);

    // Ada seed already has contact_continuity; add remaining L3 kinds.
    await seedApprovedAssertions(db, ADA, ["bot_resistance", "uniqueness"]);
    await db
      .update(accounts)
      .set({
        lifecycleState: "active",
        activatedAt: new Date("2026-08-02T00:00:00.000Z"),
      })
      .where(eq(accounts.id, ADA));

    // Ben authors a private draft (FK only — no participant activation required).
    await seedApprovedAssertions(db, BEN, L3_KINDS);
    await db
      .update(accounts)
      .set({
        lifecycleState: "active",
        activatedAt: new Date("2026-08-02T00:00:00.000Z"),
      })
      .where(eq(accounts.id, BEN));
    await db.insert(roleAssignments).values({
      id: newEntityId("role"),
      accountId: BEN,
      role: "participant",
      grantedByLabel: "ostt-synth-search-test",
      reason: "Foreign draft author fixture.",
    });

    await insertActiveAccount(db, REVIEWER, ["reviewer"]);
    await insertActiveAccount(db, AUDITOR, ["auditor"]);
    await insertActiveAccount(db, MULTI, ["participant", "reviewer"]);
    await insertActiveAccount(db, MULTI_MOD, ["participant", "moderator"]);

    const openTopic = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "search-open-topic",
      title: "ostt-synth Search open submissions topic",
      question: "What should the search ACL probe change?",
      background: "Synthetic background for workspace search tests.",
      scope: "Synthetic scope for workspace search tests.",
      jurisdictionLevel: "statewide",
      countyFips: null,
    });
    expect(openTopic.ok).toBe(true);
    if (!openTopic.ok) throw new Error("open topic create failed");
    openTopicId = openTopic.value.id;
    const opened = await transitionTopic(db, {
      actorAccountId: ADMIN,
      topicId: openTopicId,
      action: "open",
      expectedWorkflowState: "draft",
    });
    expect(opened.ok).toBe(true);

    // Draft topic (unpublished) — participants should not see unless own-submission tied.
    const draftTopic = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: "search-draft-admin-only",
      title: "ostt-synth Search draft admin-only topic",
      question: "Draft topic question?",
      background: "Draft background.",
      scope: "Draft scope.",
      jurisdictionLevel: "statewide",
      countyFips: null,
    });
    expect(draftTopic.ok).toBe(true);

    foreignDraftTitle = "ostt-synth FOREIGN private draft claim zz99";
    const foreignDraft = await insertClaim(db, {
      topicId: CEDAR_TOPIC,
      authorAccountId: BEN,
      title: foreignDraftTitle,
      summary: "Synthetic foreign private draft — must not appear for Ada.",
      approachLabel: "Foreign draft",
      synthetic: true,
      workflowState: "draft",
    });
    expect(foreignDraft.ok).toBe(true);

    wildcardTitle = "ostt-synth billing_100% literal wildcard title";
    const wildcardClaim = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: ADA,
      title: wildcardTitle,
      summary: "Synthetic claim with literal % and _ characters.",
      approachLabel: "Wildcard",
      synthetic: true,
      workflowState: "draft",
    });
    expect(wildcardClaim.ok).toBe(true);

    // Extra submitted claims for pagination ordering (Ada-owned).
    for (let i = 0; i < 3; i += 1) {
      const row = await insertClaim(db, {
        topicId: openTopicId,
        authorAccountId: ADA,
        title: `ostt-synth search page claim ${i}`,
        summary: `Pagination probe ${i}`,
        approachLabel: "Pagination",
        synthetic: true,
        workflowState: "submitted",
      });
      expect(row.ok).toBe(true);
    }
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
    if (previousDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDbUrl;
  });

  it("validates query length and escapes ILIKE wildcards", () => {
    expect(escapeIlikePattern("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
    expect(ilikeContainsPattern("bill%")).toBe("%bill\\%%");

    expect(
      workspaceSearchQuerySchema.safeParse({ q: "x" }).success,
    ).toBe(false);
    expect(
      workspaceSearchQuerySchema.safeParse({
        q: "x".repeat(WORKSPACE_SEARCH_QUERY_MIN),
      }).success,
    ).toBe(true);
    expect(
      workspaceSearchQuerySchema.safeParse({
        q: "x".repeat(WORKSPACE_SEARCH_QUERY_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("participant finds own submission by title fragment", async () => {
    const result = await searchWorkspace(db, ADA, {
      q: "billing",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.results.some((row) =>
        /billing timeline/i.test(row.title),
      ),
    ).toBe(true);
    for (const row of result.value.results) {
      expect(row.entityType).toBe("claim");
    }
  });

  it("participant cannot find another participant’s draft", async () => {
    const result = await searchWorkspace(db, ADA, {
      q: "FOREIGN private draft",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.results.some((row) => row.title === foreignDraftTitle),
    ).toBe(false);
    expect(result.value.total).toBe(0);
  });

  it("participant topic visibility covers open, published, and own-submission topics", async () => {
    const openHit = await searchWorkspace(db, ADA, {
      q: "Search open submissions",
      entities: ["topics"],
      page: 1,
      pageSize: 20,
    });
    expect(openHit.ok).toBe(true);
    if (!openHit.ok) return;
    expect(
      openHit.value.results.some((row) => row.topicSlug === "search-open-topic"),
    ).toBe(true);

    const publishedHit = await searchWorkspace(db, ADA, {
      q: "Cedar River billing",
      entities: ["topics"],
      page: 1,
      pageSize: 20,
    });
    expect(publishedHit.ok).toBe(true);
    if (!publishedHit.ok) return;
    expect(
      publishedHit.value.results.some(
        (row) => row.topicSlug === "ostt-synth-cedar-billing-ops",
      ),
    ).toBe(true);

    const draftAdminOnly = await searchWorkspace(db, ADA, {
      q: "draft admin-only",
      entities: ["topics"],
      page: 1,
      pageSize: 20,
    });
    expect(draftAdminOnly.ok).toBe(true);
    if (!draftAdminOnly.ok) return;
    expect(
      draftAdminOnly.value.results.some(
        (row) => row.topicSlug === "search-draft-admin-only",
      ),
    ).toBe(false);
  });

  it("reviewer sees non-draft claims but not foreign drafts", async () => {
    const submitted = await searchWorkspace(db, REVIEWER, {
      q: "Queue-only billing",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.value.results.length).toBeGreaterThan(0);

    const foreignDraft = await searchWorkspace(db, REVIEWER, {
      q: "FOREIGN private draft",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(foreignDraft.ok).toBe(true);
    if (!foreignDraft.ok) return;
    expect(foreignDraft.value.results).toHaveLength(0);

    const draftTopic = await searchWorkspace(db, REVIEWER, {
      q: "draft admin-only",
      entities: ["topics"],
      page: 1,
      pageSize: 20,
    });
    expect(draftTopic.ok).toBe(true);
    if (!draftTopic.ok) return;
    expect(
      draftTopic.value.results.some(
        (row) => row.topicSlug === "search-draft-admin-only",
      ),
    ).toBe(true);
  });

  it("moderator sees queue-relevant claims but not foreign drafts", async () => {
    const queue = await searchWorkspace(db, MODERATOR, {
      q: "Queue-only billing",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(queue.ok).toBe(true);
    if (!queue.ok) return;
    expect(queue.value.results.length).toBeGreaterThan(0);

    const foreignDraft = await searchWorkspace(db, MODERATOR, {
      q: "FOREIGN private draft",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(foreignDraft.ok).toBe(true);
    if (!foreignDraft.ok) return;
    expect(foreignDraft.value.results).toHaveLength(0);
  });

  it("administrator can search reviewable metadata including draft topics", async () => {
    const claims = await searchWorkspace(db, ADMIN, {
      q: "billing",
      entities: ["claims", "topics"],
      page: 1,
      pageSize: 50,
    });
    expect(claims.ok).toBe(true);
    if (!claims.ok) return;
    expect(claims.value.results.length).toBeGreaterThan(0);
    expect(
      claims.value.results.some(
        (row) => row.entityType === "topic" && /cedar/i.test(row.title),
      ),
    ).toBe(true);

    const draftTopic = await searchWorkspace(db, ADMIN, {
      q: "draft admin-only",
      entities: ["topics"],
      page: 1,
      pageSize: 20,
    });
    expect(draftTopic.ok).toBe(true);
    if (!draftTopic.ok) return;
    expect(draftTopic.value.results.length).toBeGreaterThan(0);
  });

  it("auditor-only is denied workspace.search", async () => {
    const denied = await searchWorkspace(db, AUDITOR, {
      q: "billing",
      entities: ["topics", "claims", "evidence"],
      page: 1,
      pageSize: 20,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toMatch(/AUTHZ/);
    }
  });

  it("participant+reviewer union sees own drafts and others’ non-drafts", async () => {
    const ownDraft = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: MULTI,
      title: "ostt-synth multi-role own draft claim",
      summary: "Own draft visible via participant clause.",
      approachLabel: "Multi",
      synthetic: true,
      workflowState: "draft",
    });
    expect(ownDraft.ok).toBe(true);
    if (!ownDraft.ok) return;

    const ownHit = await searchWorkspace(db, MULTI, {
      q: "multi-role own draft",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(ownHit.ok).toBe(true);
    if (!ownHit.ok) return;
    expect(ownHit.value.results.length).toBeGreaterThan(0);
    const ownRow = ownHit.value.results.find((r) => r.id === ownDraft.value.id);
    expect(ownRow?.href).toBe(
      `/workspace/submissions/${ownDraft.value.id}`,
    );

    const othersSubmitted = await searchWorkspace(db, MULTI, {
      q: "Queue-only billing",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(othersSubmitted.ok).toBe(true);
    if (!othersSubmitted.ok) return;
    expect(othersSubmitted.value.results.length).toBeGreaterThan(0);
    for (const row of othersSubmitted.value.results) {
      expect(row.href).toMatch(/^\/workspace\/review\/claims\//);
    }

    const foreignDraft = await searchWorkspace(db, MULTI, {
      q: "FOREIGN private draft",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(foreignDraft.ok).toBe(true);
    if (!foreignDraft.ok) return;
    expect(foreignDraft.value.results).toHaveLength(0);

    const published = await searchWorkspace(db, MULTI, {
      q: "Cedar River billing",
      entities: ["topics"],
      page: 1,
      pageSize: 20,
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    const publishedRow = published.value.results.find(
      (r) => r.topicSlug === "ostt-synth-cedar-billing-ops",
    );
    expect(publishedRow?.href).toBe("/topics/ostt-synth-cedar-billing-ops");
  });

  it("participant+moderator own drafts link to owner surfaces; staff non-drafts to moderation", async () => {
    const ownDraft = await insertClaim(db, {
      topicId: openTopicId,
      authorAccountId: MULTI_MOD,
      title: "ostt-synth multi-mod own draft claim",
      summary: "Own draft for participant+moderator.",
      approachLabel: "MultiMod",
      synthetic: true,
      workflowState: "draft",
    });
    expect(ownDraft.ok).toBe(true);
    if (!ownDraft.ok) return;

    const ownHit = await searchWorkspace(db, MULTI_MOD, {
      q: "multi-mod own draft",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(ownHit.ok).toBe(true);
    if (!ownHit.ok) return;
    const ownRow = ownHit.value.results.find((r) => r.id === ownDraft.value.id);
    expect(ownRow?.href).toBe(
      `/workspace/submissions/${ownDraft.value.id}`,
    );

    const staffHit = await searchWorkspace(db, MULTI_MOD, {
      q: "Queue-only billing",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(staffHit.ok).toBe(true);
    if (!staffHit.ok) return;
    expect(staffHit.value.results.length).toBeGreaterThan(0);
    for (const row of staffHit.value.results) {
      expect(row.href).toMatch(/^\/workspace\/moderation\/claims\//);
    }
  });

  it("sanitizes thrown principal/query failures to WORKSPACE_SEARCH_UNAVAILABLE", async () => {
    const broken = {
      execute: async () => {
        throw new Error("forced SQL boom with account-ostt-synth-ada");
      },
      select: () => {
        throw new Error("forced principal boom");
      },
      transaction: async () => {
        throw new Error("forced tx boom");
      },
    } as unknown as typeof db;

    const result = await searchWorkspace(broken, ADA, {
      q: "billing",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WORKSPACE_SEARCH_UNAVAILABLE");
      expect(result.error).not.toMatch(/forced|SQL|account-ostt/i);
    }
  });

  it("matches titles containing % or _ literally when those chars are searched", async () => {
    const byPercent = await searchWorkspace(db, ADA, {
      q: "100%",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(byPercent.ok).toBe(true);
    if (!byPercent.ok) return;
    expect(
      byPercent.value.results.some((row) => row.title === wildcardTitle),
    ).toBe(true);

    const byUnderscore = await searchWorkspace(db, ADA, {
      q: "billing_100",
      entities: ["claims"],
      page: 1,
      pageSize: 20,
    });
    expect(byUnderscore.ok).toBe(true);
    if (!byUnderscore.ok) return;
    expect(
      byUnderscore.value.results.some((row) => row.title === wildcardTitle),
    ).toBe(true);
  });
  it("paginates with deterministic ordering", async () => {
    const page1 = await searchWorkspace(db, ADA, {
      q: "search page claim",
      entities: ["claims"],
      page: 1,
      pageSize: 2,
    });
    expect(page1.ok).toBe(true);
    if (!page1.ok) return;
    expect(page1.value.total).toBeGreaterThanOrEqual(3);
    expect(page1.value.results).toHaveLength(2);

    const page2 = await searchWorkspace(db, ADA, {
      q: "search page claim",
      entities: ["claims"],
      page: 2,
      pageSize: 2,
    });
    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.value.results.length).toBeGreaterThan(0);

    const ids1 = page1.value.results.map((row) => row.id);
    const ids2 = page2.value.results.map((row) => row.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);

    const all = await searchWorkspace(db, ADA, {
      q: "search page claim",
      entities: ["claims"],
      page: 1,
      pageSize: 50,
    });
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    const ordered = [...all.value.results];
    const resorted = [...ordered].sort((a, b) => {
      const byTime = b.updatedAt.localeCompare(a.updatedAt);
      if (byTime !== 0) return byTime;
      const byType = a.entityType.localeCompare(b.entityType);
      if (byType !== 0) return byType;
      return a.id.localeCompare(b.id);
    });
    expect(ordered.map((r) => r.id)).toEqual(resorted.map((r) => r.id));
  });

  it("search DTO omits forbidden keys and account ids", async () => {
    const result = await searchWorkspace(db, ADA, {
      q: "billing",
      entities: ["topics", "claims", "evidence"],
      page: 1,
      pageSize: 50,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.results.length).toBeGreaterThan(0);
    const blob = JSON.stringify(result.value.results);
    for (const key of WORKSPACE_SEARCH_FORBIDDEN_KEYS) {
      expect(blob).not.toContain(`"${key}"`);
    }
    expect(blob).not.toMatch(/account-ostt-/i);
  });

  it("returns PUBLIC_DEMO_NO_SEARCH in public-demo mode", async () => {
    const priorUrl = process.env.DATABASE_URL;
    const priorAuth = process.env.AUTH_SECRET;
    process.env.APP_MODE = "public-demo";
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    try {
      const denied = await searchWorkspace(db, ADA, {
        q: "billing",
        entities: ["claims"],
        page: 1,
        pageSize: 20,
      });
      expect(denied.ok).toBe(false);
      if (!denied.ok) {
        expect(denied.code).toBe("PUBLIC_DEMO_NO_SEARCH");
      }
    } finally {
      process.env.APP_MODE = "gated";
      if (priorUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = priorUrl;
      if (priorAuth === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = priorAuth;
    }
  });

  it("resolves owner admission hrefs ahead of staff surfaces", async () => {
    const { resolveSearchHrefForTests } = await import(
      "@/lib/search/workspace-search"
    );
    expect(
      resolveSearchHrefForTests({
        entityType: "claim",
        id: "claim-own-draft",
        topicSlug: "topic-a",
        linkedClaimId: null,
        publicationStatus: "unpublished",
        admissionClass: "owner",
      }),
    ).toBe("/workspace/submissions/claim-own-draft");
    expect(
      resolveSearchHrefForTests({
        entityType: "evidence",
        id: "ev-own",
        topicSlug: "topic-a",
        linkedClaimId: "claim-own-draft",
        publicationStatus: "unpublished",
        admissionClass: "owner",
      }),
    ).toBe("/workspace/submissions/claim-own-draft");
  });

  it("resolves reviewer/moderator/published admission hrefs", async () => {
    const { resolveSearchHrefForTests } = await import(
      "@/lib/search/workspace-search"
    );
    expect(
      resolveSearchHrefForTests({
        entityType: "claim",
        id: "claim-foreign",
        topicSlug: "topic-a",
        linkedClaimId: null,
        publicationStatus: "published",
        admissionClass: "reviewer",
      }),
    ).toBe("/workspace/review/claims/claim-foreign");
    expect(
      resolveSearchHrefForTests({
        entityType: "claim",
        id: "claim-foreign",
        topicSlug: "topic-a",
        linkedClaimId: null,
        publicationStatus: "published",
        admissionClass: "moderator",
      }),
    ).toBe("/workspace/moderation/claims/claim-foreign");
    expect(
      resolveSearchHrefForTests({
        entityType: "topic",
        id: "topic-1",
        topicSlug: "ostt-synth-cedar-billing-ops",
        linkedClaimId: null,
        publicationStatus: "published",
        admissionClass: "published",
      }),
    ).toBe("/topics/ostt-synth-cedar-billing-ops");
  });

  it("paginates with bounded SQL and reports ranges", async () => {
    const page1 = await searchWorkspace(db, ADA, {
      q: "billing",
      entities: ["claims", "topics", "evidence"],
      page: 1,
      pageSize: 2,
    });
    expect(page1.ok).toBe(true);
    if (!page1.ok) return;
    expect(page1.value.results.length).toBeLessThanOrEqual(2);
    expect(page1.value.total).toBeGreaterThan(2);
    expect(page1.value.rangeFrom).toBe(1);
    expect(page1.value.rangeTo).toBe(page1.value.results.length);
    expect(page1.value.hasPrevious).toBe(false);
    expect(page1.value.hasNext).toBe(true);

    const page2 = await searchWorkspace(db, ADA, {
      q: "billing",
      entities: ["claims", "topics", "evidence"],
      page: 2,
      pageSize: 2,
    });
    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.value.hasPrevious).toBe(true);
    expect(page2.value.rangeFrom).toBe(3);
    const ids1 = page1.value.results.map((r) => r.id);
    const ids2 = page2.value.results.map((r) => r.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });
});
