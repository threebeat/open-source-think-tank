import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DrizzlePersistenceAdapter } from "@/db/drizzle-persistence";
import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  assentRecords,
  auditEvents,
  councilAppointments,
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

  it("seeds only synthetic pending_onboarding accounts", async () => {
    const rows = await db.select().from(accounts);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.synthetic)).toBe(true);
    expect(rows.every((row) => row.lifecycleState === "pending_onboarding")).toBe(
      true,
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

    await expect(
      db
        .delete(auditEvents)
        .where(eq(auditEvents.id, "audit-ostt-synth-seed")),
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
