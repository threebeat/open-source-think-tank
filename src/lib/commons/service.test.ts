import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  organizationAppointments,
  organizationMemberships,
  persons,
  profiles,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import {
  SYNTHETIC_ORG_ALPHA_ID,
  SYNTHETIC_ORG_BETA_ID,
} from "@/db/seeds/v2-organizations";
import { newEntityId } from "@/lib/auth/tokens";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { UNREVIEWED_CONTENT_DISCLAIMER } from "@/lib/commons/categories";
import {
  createPost,
  getDiscussion,
  listCommons,
  qualifyOwnProposalDenied,
  submitForFormalReview,
} from "@/lib/commons/service";
import { requireOrganizationId } from "@/lib/organizations/ids";
import { listDiscussionsForOrganization } from "@/lib/commons/repository";
import { transitionGovernanceRecord } from "@/lib/governance/service";

const ALPHA = SYNTHETIC_ORG_ALPHA_ID;
const BETA = SYNTHETIC_ORG_BETA_ID;

describe("commons service", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previous: Record<string, string | undefined>;

  beforeAll(async () => {
    previous = {
      APP_MODE: process.env.APP_MODE,
      DATABASE_URL: process.env.DATABASE_URL,
      COMMONHALL_V2_KERNEL: process.env.COMMONHALL_V2_KERNEL,
      COMMONHALL_SYNTHETIC_SEED: process.env.COMMONHALL_SYNTHETIC_SEED,
    };
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_synth_commons_unit";
    process.env.COMMONHALL_V2_KERNEL = "on";
    delete process.env.COMMONHALL_SYNTHETIC_SEED;
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  async function insertCommunityMember(suffix: string, organizationId = ALPHA) {
    const personId = newEntityId("person");
    const accountId = newEntityId("account");
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: `ostt-synth commons ${suffix}`,
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: `commons-${suffix}@ostt.synth.test`,
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await db.insert(profiles).values({
      accountId,
      preferredDisplayName: `ostt-synth ${suffix}`,
    });
    await db.insert(organizationMemberships).values({
      id: newEntityId("orgmem"),
      organizationId,
      accountId,
      status: "active",
      isPrimary: true,
      assignedAt: new Date("2026-08-02T00:00:00.000Z"),
      synthetic: true,
    });
    const principal = await loadPrincipal(db, accountId);
    if (!principal) {
      throw new Error("failed to load test principal");
    }
    return { accountId, principal };
  }

  it("requires organizationId and does not list all tenants", async () => {
    expect(() => requireOrganizationId("")).toThrow(/ORGANIZATION_ID_REQUIRED/);
    await expect(listDiscussionsForOrganization(db, "")).rejects.toThrow(
      /ORGANIZATION_ID_REQUIRED/,
    );
  });

  it("lists formal categories first, then the exact disclaimer, then informal", async () => {
    const { principal } = await insertCommunityMember("order");
    const listed = await listCommons(db, { principal, organizationId: ALPHA });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.disclaimer).toBe(UNREVIEWED_CONTENT_DISCLAIMER);
    expect(listed.value.formal.map((group) => group.category)).toEqual([
      "moderator_communications",
      "council_communications",
      "qualified_topic_discussions",
      "qualified_approach_discussions",
      "community_actions",
    ]);
    expect(listed.value.informal.map((group) => group.category)).toEqual([
      "topic_proposals",
      "approach_proposals",
      "general_discussion",
      "disqualified_topics",
    ]);
    expect(
      listed.value.formal.some((group) => group.discussions.length > 0),
    ).toBe(true);
    expect(
      listed.value.informal
        .find((group) => group.category === "general_discussion")
        ?.discussions.some((row) => row.synthetic),
    ).toBe(true);
  });

  it("hides synthetic catalog rows when COMMONHALL_SYNTHETIC_SEED is off", async () => {
    const { principal } = await insertCommunityMember("seedflag");
    const created = await createPost(db, {
      principal,
      organizationId: ALPHA,
      category: "general_discussion",
      title: "Member-visible non-catalog post",
      body: "This post is not part of the synthetic catalog.",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    process.env.COMMONHALL_SYNTHETIC_SEED = "off";
    const hidden = await listCommons(db, { principal, organizationId: ALPHA });
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    const allHidden = [
      ...hidden.value.formal,
      ...hidden.value.informal,
    ].flatMap((group) => group.discussions);
    expect(allHidden.every((row) => row.synthetic === false)).toBe(true);
    expect(
      allHidden.some((row) => row.publicId === created.value.publicId),
    ).toBe(true);

    const syntheticDetail = await getDiscussion(db, {
      principal,
      organizationId: ALPHA,
      publicId: "cpub-ostt-synth-alpha-general",
    });
    expect(syntheticDetail.ok).toBe(false);

    delete process.env.COMMONHALL_SYNTHETIC_SEED;
    const shown = await listCommons(db, { principal, organizationId: ALPHA });
    expect(shown.ok).toBe(true);
    if (!shown.ok) return;
    const allShown = [
      ...shown.value.formal,
      ...shown.value.informal,
    ].flatMap((group) => group.discussions);
    expect(allShown.some((row) => row.synthetic)).toBe(true);
  });

  it("creates an informal post for a community member and refuses formal shortcuts", async () => {
    const { principal } = await insertCommunityMember("poster");
    const created = await createPost(db, {
      principal,
      organizationId: ALPHA,
      category: "general_discussion",
      title: "Neighborhood flood markers",
      body: "Should the hall map high-water marks on the river path?",
      formal: true,
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.code).toBe("COMMONS_FORMAL_FORBIDDEN");
    }

    const informal = await createPost(db, {
      principal,
      organizationId: ALPHA,
      category: "general_discussion",
      title: "Neighborhood flood markers",
      body: "Should the hall map high-water marks on the river path?",
    });
    expect(informal.ok).toBe(true);
    if (!informal.ok) return;
    const listed = await listCommons(db, { principal, organizationId: ALPHA });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const general = listed.value.informal.find(
      (group) => group.category === "general_discussion",
    );
    expect(
      general?.discussions.some((row) => row.publicId === informal.value.publicId),
    ).toBe(true);
    const detail = await getDiscussion(db, {
      principal,
      organizationId: ALPHA,
      publicId: informal.value.publicId,
    });
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.formal).toBe(false);
    expect(detail.value.authoredByViewer).toBe(true);
    expect(JSON.stringify(detail.value)).not.toMatch(/account_/);
  });

  it("denies posting without community membership, including platform admin", async () => {
    const admin = await loadPrincipal(db, "account-ostt-synth-staff-admin");
    const denied = await createPost(db, {
      principal: admin,
      organizationId: ALPHA,
      category: "general_discussion",
      title: "Admin post",
      body: "Platform admin should not post without membership.",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe("COMMONS_MEMBERSHIP_REQUIRED");
    }

    const { principal } = await insertCommunityMember("elevated");
    const formalCategory = await createPost(db, {
      principal,
      organizationId: ALPHA,
      category: "moderator_communications",
      title: "Not allowed",
      body: "Members cannot write formal categories.",
    });
    expect(formalCategory.ok).toBe(false);
    if (!formalCategory.ok) {
      expect(formalCategory.code).toBe("COMMONS_CATEGORY_FORBIDDEN");
    }
  });

  it("denies cross-organization discussion reads", async () => {
    const { principal } = await insertCommunityMember("idor");
    const created = await createPost(db, {
      principal,
      organizationId: ALPHA,
      category: "general_discussion",
      title: "Alpha-only post",
      body: "Must not be readable from beta.",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const beta = await getDiscussion(db, {
      principal,
      organizationId: BETA,
      publicId: created.value.publicId,
    });
    expect(beta.ok).toBe(false);
    if (!beta.ok) {
      expect(beta.code).toBe("COMMONS_DISCUSSION_NOT_FOUND");
    }
    const betaList = await listCommons(db, {
      principal,
      organizationId: BETA,
    });
    expect(betaList.ok).toBe(true);
    if (!betaList.ok) return;
    const betaIds = [...betaList.value.formal, ...betaList.value.informal]
      .flatMap((group) => group.discussions)
      .map((row) => row.publicId);
    expect(betaIds).not.toContain(created.value.publicId);
  });

  it("submits proposals through the kernel and refuses self-qualify and agenda jumps", async () => {
    const { accountId, principal } = await insertCommunityMember("proposer");
    const created = await createPost(db, {
      principal,
      organizationId: ALPHA,
      category: "topic_proposals",
      title: "Evening bus frequency",
      body: "Should the hall examine evening bus frequency as a formal topic?",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const jumped = await submitForFormalReview(db, {
      principal,
      organizationId: ALPHA,
      publicId: created.value.publicId,
    });
    expect(jumped.ok).toBe(true);
    if (!jumped.ok) return;
    expect(jumped.value.to).toBe("formal_review_pending");

    const detail = await getDiscussion(db, {
      principal,
      organizationId: ALPHA,
      publicId: created.value.publicId,
    });
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.governanceState).toBe("formal_review_pending");
    expect(detail.value.canSubmitForFormalReview).toBe(false);

    await db.insert(organizationAppointments).values({
      id: newEntityId("orgappt"),
      organizationId: ALPHA,
      accountId,
      appointmentKind: "moderator",
      termStartsAt: new Date("2026-01-01T00:00:00.000Z"),
      issuedByAccountId: "account-ostt-synth-staff-admin",
      issuedByPrincipalKind: "organization_officer",
      synthetic: true,
    });
    const asModerator = await loadPrincipal(db, accountId);
    const selfQualify = await qualifyOwnProposalDenied(db, {
      principal: asModerator,
      organizationId: ALPHA,
      publicId: created.value.publicId,
    });
    expect(selfQualify.ok).toBe(false);
    if (!selfQualify.ok) {
      expect(selfQualify.code).toBe("GOVERNANCE_SELF_REVIEW_FORBIDDEN");
    }

    const discussion = await listDiscussionsForOrganization(db, ALPHA);
    const row = discussion.find((item) => item.publicId === created.value.publicId);
    expect(row?.topicGovernanceRecordId).toBeTruthy();
    const chamberJump = await transitionGovernanceRecord(db, {
      principal: asModerator,
      organizationId: ALPHA,
      recordId: row!.topicGovernanceRecordId!,
      action: "queue_for_chamber",
      actor: "system_from_published_rule",
      trustedSystem: true,
      synthetic: true,
    });
    expect(chamberJump.ok).toBe(false);
    if (!chamberJump.ok) {
      expect(chamberJump.code).toBe("GOVERNANCE_ILLEGAL_TRANSITION");
    }
  });

  it("does not grant elevated capability after posting", async () => {
    const { accountId, principal } = await insertCommunityMember("noelevate");
    expect(principal.organizationAppointments ?? []).toEqual([]);
    const created = await createPost(db, {
      principal,
      organizationId: ALPHA,
      category: "general_discussion",
      title: "Posting is not an appointment",
      body: "Community membership still grants no Chamber or Council seat.",
    });
    expect(created.ok).toBe(true);
    const after = await loadPrincipal(db, accountId);
    expect(after?.organizationAppointments ?? []).toEqual([]);
    expect(after?.platformRoles ?? []).toEqual([]);
  });
});
