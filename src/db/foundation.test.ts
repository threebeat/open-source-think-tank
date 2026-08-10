import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DrizzlePersistenceAdapter } from "@/db/drizzle-persistence";
import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  assentRecords,
  auditEvents,
  councilAppointments,
  documentVersions,
  invitations,
  verificationAssertions,
  verificationCases,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { asDrizzleTx } from "@/db/transaction-context";

describe("foundation schema (ephemeral PGlite)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];

  beforeAll(async () => {
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client.close();
  });

  it("seeds only synthetic accounts with expected lifecycle states", async () => {
    const rows = await db.select().from(accounts);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.synthetic)).toBe(true);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId["account-ostt-synth-ada"]?.lifecycleState).toBe(
      "pending_onboarding",
    );
    expect(byId["account-ostt-synth-ben"]?.lifecycleState).toBe(
      "pending_onboarding",
    );
    expect(byId["account-ostt-synth-staff-admin"]?.lifecycleState).toBe(
      "active",
    );
  });

  it("keeps deliberation and policy council appointments independent", async () => {
    const rows = await db
      .select()
      .from(councilAppointments)
      .where(eq(councilAppointments.accountId, "account-ostt-synth-ada"));
    const roles = rows.map((row) => row.councilRole).sort();
    expect(roles).toEqual(["deliberation_council", "policy_council"]);
  });

  it("rejects active accounts without activatedAt", async () => {
    await expect(
      db.insert(accounts).values({
        id: "account-ostt-synth-bad-active",
        personId: "person-ostt-synth-ada",
        contactChannel: "bad-active@ostt.synth.test",
        lifecycleState: "active",
        synthetic: true,
        activatedAt: null,
      }),
    ).rejects.toThrow();
  });

  it("rejects pending_onboarding without contactVerifiedAt", async () => {
    await expect(
      db.insert(accounts).values({
        id: "account-ostt-synth-bad-pending",
        personId: "person-ostt-synth-ada",
        contactChannel: "bad-pending@ostt.synth.test",
        lifecycleState: "pending_onboarding",
        synthetic: true,
        contactVerifiedAt: null,
      }),
    ).rejects.toThrow();
  });

  it("rejects accepted invitations without account and timestamp", async () => {
    await expect(
      db.insert(invitations).values({
        id: "invite-ostt-synth-bad-accepted",
        tokenHash: createHash("sha256")
          .update("ostt-synth-bad-accepted")
          .digest("hex"),
        intendedContactChannel: "bad-accepted@ostt.synth.test",
        status: "accepted",
        synthetic: true,
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
        acceptedAt: null,
        acceptedAccountId: null,
        issuedByLabel: "ostt-synth-seeder",
      }),
    ).rejects.toThrow();
  });

  it("rejects assent to a draft document", async () => {
    const body = "Synthetic draft document body.";
    const contentHash = createHash("sha256").update(body).digest("hex");
    await db.insert(documentVersions).values({
      id: "doc-ostt-synth-draft-v1",
      kind: "conduct",
      versionLabel: "v1-draft-synth",
      contentHash,
      title: "Synthetic draft conduct",
      body,
      state: "draft",
    });

    await expect(
      db.insert(assentRecords).values({
        id: "assent-ostt-synth-draft",
        accountId: "account-ostt-synth-ada",
        documentVersionId: "doc-ostt-synth-draft-v1",
        contentHash,
        method: "synthetic-negative",
        noticesAcknowledged: [],
        synthetic: true,
      }),
    ).rejects.toThrow();
  });

  it("rejects assent to a withdrawn document", async () => {
    const body = "Synthetic withdrawn document body.";
    const contentHash = createHash("sha256").update(body).digest("hex");
    const reviewedAt = new Date("2026-07-01T00:00:00.000Z");
    const publishedAt = new Date("2026-07-01T01:00:00.000Z");
    await db.insert(documentVersions).values({
      id: "doc-ostt-synth-withdrawn-v1",
      kind: "participation",
      versionLabel: "v1-withdrawn-synth",
      contentHash,
      title: "Synthetic withdrawn participation",
      body,
      state: "draft",
      requiredNotices: [],
    });
    await db
      .update(documentVersions)
      .set({
        state: "counsel_reviewed",
        counselReviewedAt: reviewedAt,
        counselReviewedByAccountId: "account-ostt-synth-ben",
        updatedAt: reviewedAt,
      })
      .where(eq(documentVersions.id, "doc-ostt-synth-withdrawn-v1"));
    await db
      .update(documentVersions)
      .set({
        state: "published",
        publishedAt,
        publishedByAccountId: "account-ostt-synth-ben",
        updatedAt: publishedAt,
      })
      .where(eq(documentVersions.id, "doc-ostt-synth-withdrawn-v1"));
    await db
      .update(documentVersions)
      .set({
        state: "withdrawn",
        updatedAt: new Date("2026-07-02T00:00:00.000Z"),
      })
      .where(eq(documentVersions.id, "doc-ostt-synth-withdrawn-v1"));

    await expect(
      db.insert(assentRecords).values({
        id: "assent-ostt-synth-withdrawn",
        accountId: "account-ostt-synth-ada",
        documentVersionId: "doc-ostt-synth-withdrawn-v1",
        contentHash,
        method: "synthetic-negative",
        noticesAcknowledged: [],
        synthetic: true,
      }),
    ).rejects.toThrow();
  });

  it("rejects assent when contentHash does not match the document", async () => {
    await expect(
      db.insert(assentRecords).values({
        id: "assent-ostt-synth-hash-mismatch",
        accountId: "account-ostt-synth-ada",
        documentVersionId: "doc-ostt-synth-privacy-v1",
        contentHash: createHash("sha256")
          .update("not-the-document-body")
          .digest("hex"),
        method: "synthetic-negative",
        noticesAcknowledged: [],
        synthetic: true,
      }),
    ).rejects.toThrow();
  });

  it("rejects verification assertions whose kind differs from the case", async () => {
    await expect(
      db.insert(verificationAssertions).values({
        id: "vassert-ostt-synth-kind-mismatch",
        caseId: "vcase-ostt-synth-ada-contact",
        kind: "eligibility",
        assertionSummary: "Synthetic kind mismatch must fail.",
      }),
    ).rejects.toThrow();
  });

  it("rejects self-review on verification cases", async () => {
    await expect(
      db.insert(verificationCases).values({
        id: "vcase-ostt-synth-self-review",
        accountId: "account-ostt-synth-ada",
        kind: "eligibility",
        status: "pending",
        reviewerAccountId: "account-ostt-synth-ada",
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate active council role for the same account", async () => {
    await expect(
      db.insert(councilAppointments).values({
        id: "council-ostt-synth-ada-deliberation-dup",
        accountId: "account-ostt-synth-ada",
        councilRole: "deliberation_council",
        selectionPath: "Duplicate should fail.",
        termStartsOn: new Date("2026-08-02T00:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("makes assent and audit rows immutable", async () => {
    await expect(
      db
        .update(assentRecords)
        .set({ method: "tamper" })
        .where(eq(assentRecords.id, "assent-ostt-synth-ada-privacy-v1")),
    ).rejects.toThrow();

    const [seedAudit] = await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(eq(auditEvents.action, "foundation.seeded"))
      .limit(1);
    expect(seedAudit?.id).toBeTruthy();
    await expect(
      db.delete(auditEvents).where(eq(auditEvents.id, seedAudit!.id)),
    ).rejects.toThrow();

    const assent = await db
      .select()
      .from(assentRecords)
      .where(eq(assentRecords.id, "assent-ostt-synth-ada-privacy-v1"));
    expect(assent[0]?.method).toBe("synthetic-seed");
  });

  it("passes a transaction-scoped executor into withTransaction", async () => {
    const persistence = new DrizzlePersistenceAdapter(db);
    const result = await persistence.withTransaction(async (tx) => {
      expect(tx.transactionId).toMatch(
        /^[0-9a-f-]{36}$/i,
      );
      const executor = asDrizzleTx(tx);
      const rows = await executor
        .select()
        .from(accounts)
        .where(eq(accounts.id, "account-ostt-synth-ada"));
      return rows[0]?.contactChannel;
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("ada@ostt.synth.test");
    }
  });

  it("rolls back failed transactions via the scoped executor", async () => {
    const persistence = new DrizzlePersistenceAdapter(db);
    const failed = await persistence.withTransaction(async (tx) => {
      const executor = asDrizzleTx(tx);
      await executor.insert(accounts).values({
        id: "account-ostt-synth-rollback",
        personId: "person-ostt-synth-ben",
        contactChannel: "rollback@ostt.synth.test",
        lifecycleState: "invited",
        synthetic: true,
      });
      throw new Error("force rollback");
    });
    expect(failed.ok).toBe(false);

    const rows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, "account-ostt-synth-rollback"));
    expect(rows).toHaveLength(0);
  });
});
