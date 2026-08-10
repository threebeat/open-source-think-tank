import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  assentRecords,
  auditEvents,
  persons,
  roleAssignments,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { newEntityId } from "@/lib/auth/tokens";
import {
  executeAccountClosure,
  requestAccountClosure,
} from "@/lib/privacy/closure";
import {
  approveDualControl,
  requestDualControl,
} from "@/lib/privacy/dual-control";
import { exportOwnAccountData } from "@/lib/privacy/export";
import {
  hasActiveLegalHold,
  placeLegalHold,
  releaseLegalHold,
} from "@/lib/privacy/legal-hold";
import { runRetentionExpirationJob } from "@/lib/privacy/retention";
import { assertCsrfSafe } from "@/lib/security/csrf";
import { SECURITY_HEADERS } from "@/lib/security/headers";
import { L3_KINDS, seedApprovedAssertions } from "@/lib/verification/seed-assurance";

describe("privacy and operational controls (2.11)", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_privacy_test";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);

    for (const [id, role] of [
      ["account-ostt-synth-privacy-admin-a", "administrator"],
      ["account-ostt-synth-privacy-admin-b", "administrator"],
    ] as const) {
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
      await db.insert(roleAssignments).values({
        id: newEntityId("role"),
        accountId: id,
        role,
        grantedByLabel: "ostt-synth-privacy-test",
        reason: "Privacy ops fixture.",
      });
      await seedApprovedAssertions(db, id, L3_KINDS);
    }
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

  it("exports only the requesting account’s records", async () => {
    const exported = await exportOwnAccountData(db, "account-ostt-synth-ada");
    expect(exported.ok).toBe(true);
    if (!exported.ok) {
      return;
    }
    expect(exported.value.accountId).toBe("account-ostt-synth-ada");
    expect(JSON.stringify(exported.value)).not.toContain(
      "account-ostt-synth-ben",
    );
    expect(exported.value.assentRecords.length).toBeGreaterThan(0);
  });

  it("closes an account without destroying assent or audit history", async () => {
    const personId = newEntityId("person");
    const accountId = "account-ostt-synth-privacy-closee";
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth closee",
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: "closee@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const requested = await requestAccountClosure(db, {
      accountId,
      actorAccountId: accountId,
      reason: "Synthetic closure request drill.",
    });
    expect(requested.ok).toBe(true);

    const assentBefore = await db
      .select()
      .from(assentRecords)
      .where(eq(assentRecords.accountId, "account-ostt-synth-ada"));

    const closed = await executeAccountClosure(db, {
      accountId,
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      reason: "Synthetic closure execution drill.",
      requestId: requested.ok ? requested.value.requestId : undefined,
    });
    expect(closed.ok).toBe(true);

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    expect(account?.lifecycleState).toBe("closed");
    expect(account?.closedAt).toBeTruthy();

    const assentAfter = await db
      .select()
      .from(assentRecords)
      .where(eq(assentRecords.accountId, "account-ostt-synth-ada"));
    expect(assentAfter.length).toBe(assentBefore.length);

    const closureAudits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "privacy.account_closed"));
    expect(closureAudits.length).toBeGreaterThan(0);
  });

  it("blocks closure when a legal hold is active and supports dual control", async () => {
    const hold = await placeLegalHold(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      subjectType: "account",
      subjectId: "account-ostt-synth-ben",
      reason: "Synthetic litigation hold drill.",
    });
    expect(hold.ok).toBe(true);
    expect(await hasActiveLegalHold(db, "account", "account-ostt-synth-ben")).toBe(
      true,
    );

    const blocked = await executeAccountClosure(db, {
      accountId: "account-ostt-synth-ben",
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      reason: "Should be blocked by hold.",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe("CLOSURE_BLOCKED_BY_HOLD");
    }

    const dual = await requestDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      action: "privacy.release_legal_hold",
      payload: { holdId: hold.ok ? hold.value.id : "" },
      reason: "Need second administrator to release hold.",
    });
    expect(dual.ok).toBe(true);

    const selfApprove = await approveDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      requestId: dual.ok ? dual.value.id : "",
      reason: "Self approve must fail.",
    });
    expect(selfApprove.ok).toBe(false);

    const approved = await approveDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      requestId: dual.ok ? dual.value.id : "",
      reason: "Second administrator approves release.",
    });
    expect(approved.ok).toBe(true);

    const released = await releaseLegalHold(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      holdId: hold.ok ? hold.value.id : "",
      reason: "Release after dual control.",
    });
    expect(released.ok).toBe(true);
  });

  it("runs provisional retention job and keeps security headers/csrf helpers", async () => {
    const job = await runRetentionExpirationJob(db, {
      actorLabel: "ostt-synth-privacy-test",
    });
    expect(job.ok).toBe(true);
    if (job.ok) {
      expect(job.value.provisional).toBe(true);
    }

    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toMatch(/frame-ancestors 'none'/);

    expect(() =>
      assertCsrfSafe(
        new Request("http://localhost/api/account/export", {
          method: "POST",
          headers: {
            origin: "http://evil.example",
            host: "localhost",
          },
        }),
      ),
    ).toThrow(/CSRF_ORIGIN_MISMATCH/);

    expect(() =>
      assertCsrfSafe(
        new Request("http://localhost/api/account/export", {
          method: "POST",
          headers: {
            origin: "http://localhost",
            host: "localhost",
          },
        }),
      ),
    ).not.toThrow();
  });
});
