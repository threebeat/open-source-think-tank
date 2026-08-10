import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  assentOutcomes,
  documentVersions,
  persons,
  roleAssignments,
  verificationCases,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { newEntityId } from "@/lib/auth/tokens";
import { activateAccount } from "@/lib/onboarding/activate";
import { getOnboardingProgress } from "@/lib/onboarding/progress";
import {
  listStaffInvitations,
  listStaffOnboardingStatuses,
} from "@/lib/onboarding/staff";
import {
  L2_KINDS,
  seedApprovedAssertions,
} from "@/lib/verification/seed-assurance";

async function seedEngineeringGates(
  db: Awaited<ReturnType<typeof createTestDatabase>>["db"],
  accountId: string,
) {
  await seedApprovedAssertions(db, accountId, [
    "bot_resistance",
    "uniqueness",
    "eligibility",
  ]);
  // contact_continuity may already exist for ada; ignore conflicts by checking.
  const existing = await db
    .select()
    .from(verificationCases)
    .where(eq(verificationCases.accountId, accountId));
  if (!existing.some((row) => row.kind === "contact_continuity")) {
    await seedApprovedAssertions(db, accountId, ["contact_continuity"]);
  }
}

describe("invite-only onboarding (2.8)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];

  beforeAll(async () => {
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);

    const personId = newEntityId("person");
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth Staff Reviewer",
    });
    await db.insert(accounts).values({
      id: "account-ostt-synth-staff-reader",
      personId,
      contactChannel: "staff-reader@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await db.insert(roleAssignments).values({
      id: newEntityId("role"),
      accountId: "account-ostt-synth-staff-reader",
      role: "reviewer",
      grantedByLabel: "ostt-synth-onboarding-test",
      reason: "Staff onboarding read fixture.",
    });
    await seedApprovedAssertions(
      db,
      "account-ostt-synth-staff-reader",
      L2_KINDS,
    );
  }, 120_000);

  afterAll(async () => {
    await client.close();
  });

  it("blocks real accounts with ONBOARD_COUNSEL_GATE_BLOCKED while counsel gates block", async () => {
    const personId = newEntityId("person");
    const accountId = "account-real-onboard-blocked";
    await db.insert(persons).values({
      id: personId,
      synthetic: false,
      displayLabel: "Real pending account",
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: "real-onboard@example.test",
      lifecycleState: "pending_onboarding",
      synthetic: false,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    // Reuse published privacy doc assent
    const [doc] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.state, "published"));
    expect(doc).toBeTruthy();
    const { assentRecords } = await import("@/db/schema");
    await db.insert(assentRecords).values({
      id: newEntityId("assent"),
      accountId,
      documentVersionId: doc!.id,
      contentHash: doc!.contentHash,
      method: "gated-ui",
      noticesAcknowledged: doc!.requiredNotices,
      synthetic: false,
    });
    await seedEngineeringGates(db, accountId);

    const progress = await getOnboardingProgress(db, accountId);
    expect(progress?.engineeringReady).toBe(true);
    expect(progress?.counselBlocksReal).toBe(true);
    expect(progress?.canActivate).toBe(false);

    const blocked = await activateAccount(db, { accountId });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe("ONBOARD_COUNSEL_GATE_BLOCKED");
    }
  });

  it("activates synthetic accounts when engineering gates pass", async () => {
    const before = await getOnboardingProgress(db, "account-ostt-synth-ada");
    expect(before?.canActivate).toBe(false);

    await seedEngineeringGates(db, "account-ostt-synth-ada");
    const ready = await getOnboardingProgress(db, "account-ostt-synth-ada");
    expect(ready?.canActivate).toBe(true);

    const activated = await activateAccount(db, {
      accountId: "account-ostt-synth-ada",
    });
    expect(activated.ok).toBe(true);

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, "account-ostt-synth-ada"));
    expect(account?.lifecycleState).toBe("active");
  });

  it("fails activation when assent is withdrawn inside the transaction", async () => {
    // Prepare ben with gates (still pending)
    const [doc] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.state, "published"));
    const { assentRecords } = await import("@/db/schema");
    const existingAssent = await db
      .select()
      .from(assentRecords)
      .where(eq(assentRecords.accountId, "account-ostt-synth-ben"));
    let assentId = existingAssent[0]?.id;
    if (!assentId) {
      assentId = newEntityId("assent");
      await db.insert(assentRecords).values({
        id: assentId,
        accountId: "account-ostt-synth-ben",
        documentVersionId: doc!.id,
        contentHash: doc!.contentHash,
        method: "gated-ui",
        noticesAcknowledged: doc!.requiredNotices,
        synthetic: true,
      });
    }
    await seedEngineeringGates(db, "account-ostt-synth-ben");

    const failed = await activateAccount(db, {
      accountId: "account-ostt-synth-ben",
      afterEvaluate: async (tx) => {
        await tx.insert(assentOutcomes).values({
          id: newEntityId("outcome"),
          accountId: "account-ostt-synth-ben",
          documentVersionId: doc!.id,
          contentHash: doc!.contentHash,
          outcome: "withdrawn",
          priorAssentId: assentId,
          reason: "Injected withdrawal during activation.",
          synthetic: true,
        });
      },
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.code).toBe("ONBOARD_GATES_INCOMPLETE");
    }
  });

  it("fails activation when verification is revoked inside the transaction", async () => {
    const personId = newEntityId("person");
    const accountId = "account-ostt-synth-activate-revoke";
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth revoke race",
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: "activate-revoke@ostt.synth.test",
      lifecycleState: "pending_onboarding",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const [doc] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.state, "published"));
    const { assentRecords } = await import("@/db/schema");
    await db.insert(assentRecords).values({
      id: newEntityId("assent"),
      accountId,
      documentVersionId: doc!.id,
      contentHash: doc!.contentHash,
      method: "gated-ui",
      noticesAcknowledged: doc!.requiredNotices,
      synthetic: true,
    });
    await seedApprovedAssertions(db, accountId, [
      "bot_resistance",
      "contact_continuity",
      "uniqueness",
      "eligibility",
    ]);

    const [elig] = await db
      .select()
      .from(verificationCases)
      .where(eq(verificationCases.accountId, accountId));

    const failed = await activateAccount(db, {
      accountId,
      afterEvaluate: async (tx) => {
        await tx
          .update(verificationCases)
          .set({
            status: "revoked",
            decisionReason: "Revoked during activation race.",
            decidedAt: new Date(),
          })
          .where(eq(verificationCases.id, elig!.id));
      },
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.code).toBe("ONBOARD_GATES_INCOMPLETE");
    }
  });

  it("fails activation when the published document is superseded inside the transaction", async () => {
    const personId = newEntityId("person");
    const accountId = "account-ostt-synth-activate-supersede";
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth supersede race",
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: "activate-supersede@ostt.synth.test",
      lifecycleState: "pending_onboarding",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const [doc] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.state, "published"));
    const { assentRecords } = await import("@/db/schema");
    await db.insert(assentRecords).values({
      id: newEntityId("assent"),
      accountId,
      documentVersionId: doc!.id,
      contentHash: doc!.contentHash,
      method: "gated-ui",
      noticesAcknowledged: doc!.requiredNotices,
      synthetic: true,
    });
    await seedApprovedAssertions(db, accountId, [
      "bot_resistance",
      "contact_continuity",
      "uniqueness",
      "eligibility",
    ]);

    const failed = await activateAccount(db, {
      accountId,
      afterEvaluate: async (tx) => {
        const now = new Date();
        await tx
          .update(documentVersions)
          .set({
            state: "superseded",
            supersededAt: now,
            updatedAt: now,
          })
          .where(eq(documentVersions.id, doc!.id));
        // Insert a new published doc that lacks assent (state machine: draft→reviewed→published)
        const body = "Replacement privacy notice for supersession race.";
        const { createHash } = await import("node:crypto");
        const hash = createHash("sha256").update(body).digest("hex");
        const newId = newEntityId("doc");
        await tx.insert(documentVersions).values({
          id: newId,
          kind: "privacy_notice",
          versionLabel: "v-race-synth",
          contentHash: hash,
          title: "Replacement privacy notice",
          body,
          state: "draft",
          requiredNotices: ["synthetic-notice"],
        });
        await tx
          .update(documentVersions)
          .set({
            state: "counsel_reviewed",
            counselReviewedAt: now,
            counselReviewedByAccountId: "account-ostt-synth-ben",
            updatedAt: now,
          })
          .where(eq(documentVersions.id, newId));
        await tx
          .update(documentVersions)
          .set({
            state: "published",
            publishedAt: now,
            publishedByAccountId: "account-ostt-synth-ben",
            updatedAt: now,
          })
          .where(eq(documentVersions.id, newId));
      },
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.code).toBe("ONBOARD_GATES_INCOMPLETE");
    }
  });

  it("allows only one of two simultaneous activation requests", async () => {
    const personId = newEntityId("person");
    const accountId = "account-ostt-synth-activate-race";
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth dual activate",
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: "activate-race@ostt.synth.test",
      lifecycleState: "pending_onboarding",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const [doc] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.state, "published"));
    const { assentRecords } = await import("@/db/schema");
    await db.insert(assentRecords).values({
      id: newEntityId("assent"),
      accountId,
      documentVersionId: doc!.id,
      contentHash: doc!.contentHash,
      method: "gated-ui",
      noticesAcknowledged: doc!.requiredNotices,
      synthetic: true,
    });
    await seedApprovedAssertions(db, accountId, [
      "bot_resistance",
      "contact_continuity",
      "uniqueness",
      "eligibility",
    ]);

    const [a, b] = await Promise.all([
      activateAccount(db, { accountId }),
      activateAccount(db, { accountId }),
    ]);
    const oks = [a, b].filter((row) => row.ok);
    const fails = [a, b].filter((row) => !row.ok);
    expect(oks).toHaveLength(1);
    expect(fails).toHaveLength(1);
  });

  it("staff views redact contacts and require assurance", async () => {
    const unauthorized = await listStaffOnboardingStatuses(
      db,
      "account-ostt-synth-ben",
    );
    expect(unauthorized.ok).toBe(false);

    const staff = await listStaffOnboardingStatuses(
      db,
      "account-ostt-synth-staff-reader",
    );
    expect(staff.ok).toBe(true);
    if (staff.ok) {
      for (const row of staff.value) {
        expect(row.contactRedacted).toMatch(/\*\*\*@/);
      }
    }

    const invites = await listStaffInvitations(
      db,
      "account-ostt-synth-staff-reader",
    );
    expect(invites.ok).toBe(true);
  });
});
