import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { createTestDatabase } from "@/db/pglite";
import {
  accountDeletionRequests,
  accounts,
  assentRecords,
  dualControlRequests,
  legalHolds,
  persons,
  profiles,
  roleAssignments,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import * as auditLog from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import {
  executeAccountClosure,
  requestAccountClosure,
} from "@/lib/privacy/closure";
import * as securityLogModule from "@/lib/security/log";
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

describe("privacy and operational controls (2.11/2.12 hardening)", () => {
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
      ["account-ostt-synth-privacy-admin-c", "administrator"],
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

  it("aborts when a foreign account sentinel appears in the export bundle", async () => {
    const actorId = "account-ostt-synth-ada";
    const foreignSentinel = "account-ostt-synth-ben";
    const [before] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.accountId, actorId))
      .limit(1);
    expect(before).toBeTruthy();

    await db
      .update(profiles)
      .set({ preferredDisplayName: `planted ${foreignSentinel}` })
      .where(eq(profiles.accountId, actorId));

    try {
      const blocked = await exportOwnAccountData(db, actorId);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.code).toBe("EXPORT_CROSS_ACCOUNT_BLOCKED");
      }
    } finally {
      await db
        .update(profiles)
        .set({ preferredDisplayName: before!.preferredDisplayName })
        .where(eq(profiles.accountId, actorId));
    }
  });

  it("does not return a successful export when audit append fails", async () => {
    const auditSpy = vi
      .spyOn(auditLog, "appendAuthAudit")
      .mockRejectedValue(new Error("forced export audit failure"));
    await expect(
      exportOwnAccountData(db, "account-ostt-synth-ada"),
    ).rejects.toThrow(/forced export audit failure/);
    auditSpy.mockRestore();
  });

  it("closes an account only with a claimed dual-control request", async () => {
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
    if (!requested.ok) {
      return;
    }

    const bypass = await executeAccountClosure(db, {
      accountId,
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      reason: "Bypass without dual control.",
      dualControlRequestId: "",
      workflow: "account_request",
      deletionRequestId: requested.value.requestId,
    });
    expect(bypass.ok).toBe(false);
    if (!bypass.ok) {
      expect(bypass.code).toBe("DUAL_CONTROL_REQUIRED");
    }

    const dual = await requestDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      action: "privacy.execute_closure",
      payload: {
        workflow: "account_request",
        accountId,
        deletionRequestId: requested.value.requestId,
      },
      reason: "Closure dual control.",
    });
    expect(dual.ok).toBe(true);
    if (!dual.ok) {
      return;
    }
    const approved = await approveDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      requestId: dual.value.id,
      reason: "Approve closure.",
    });
    expect(approved.ok).toBe(true);

    const assentBefore = await db
      .select()
      .from(assentRecords)
      .where(eq(assentRecords.accountId, "account-ostt-synth-ada"));

    const closed = await executeAccountClosure(db, {
      accountId,
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      reason: "Synthetic closure execution drill.",
      dualControlRequestId: dual.value.id,
      workflow: "account_request",
      deletionRequestId: requested.value.requestId,
    });
    expect(closed.ok).toBe(true);

    const replay = await executeAccountClosure(db, {
      accountId,
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      reason: "Replay must fail.",
      dualControlRequestId: dual.value.id,
      workflow: "account_request",
      deletionRequestId: requested.value.requestId,
    });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.code).toBe("DUAL_CONTROL_ALREADY_EXECUTED");
    }

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    expect(account?.lifecycleState).toBe("closed");

    const assentAfter = await db
      .select()
      .from(assentRecords)
      .where(eq(assentRecords.accountId, "account-ostt-synth-ada"));
    expect(assentAfter.length).toBe(assentBefore.length);
  });

  it("enforces dual-control claim, payload match, and concurrent approval", async () => {
    const hold = await placeLegalHold(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      subjectType: "account",
      subjectId: "account-ostt-synth-ben",
      reason: "Synthetic litigation hold drill.",
    });
    expect(hold.ok).toBe(true);
    if (!hold.ok) {
      return;
    }

    const closureDual = await requestDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      action: "privacy.execute_closure",
      payload: {
        workflow: "administrator_initiated",
        accountId: "account-ostt-synth-ben",
      },
      reason: "Closure while hold active.",
    });
    expect(closureDual.ok).toBe(true);
    if (!closureDual.ok) {
      return;
    }
    const closureApproved = await approveDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      requestId: closureDual.value.id,
      reason: "Approve blocked closure attempt.",
    });
    expect(closureApproved.ok).toBe(true);

    const blocked = await executeAccountClosure(db, {
      accountId: "account-ostt-synth-ben",
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      reason: "Should be blocked by hold.",
      dualControlRequestId: closureDual.value.id,
      workflow: "administrator_initiated",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe("CLOSURE_BLOCKED_BY_HOLD");
    }
    const [blockedDualRow] = await db
      .select()
      .from(dualControlRequests)
      .where(eq(dualControlRequests.id, closureDual.value.id));
    expect(blockedDualRow?.status).toBe("approved");

    const dual = await requestDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      action: "privacy.release_legal_hold",
      payload: { holdId: hold.value.id },
      reason: "Need second administrator to release hold.",
    });
    expect(dual.ok).toBe(true);
    if (!dual.ok) {
      return;
    }

    const concurrent = await Promise.all([
      approveDualControl(db, {
        actorAccountId: "account-ostt-synth-privacy-admin-b",
        requestId: dual.value.id,
        reason: "Approver B",
      }),
      approveDualControl(db, {
        actorAccountId: "account-ostt-synth-privacy-admin-c",
        requestId: dual.value.id,
        reason: "Approver C",
      }),
    ]);
    expect(concurrent.filter((row) => row.ok)).toHaveLength(1);
    expect(concurrent.some((row) => !row.ok)).toBe(true);

    const otherHold = await placeLegalHold(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      subjectType: "account",
      subjectId: "account-ostt-synth-ada",
      reason: "Second hold for payload substitution drill.",
    });
    expect(otherHold.ok).toBe(true);
    if (!otherHold.ok) {
      return;
    }

    const substituted = await releaseLegalHold(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      holdId: otherHold.value.id,
      reason: "Wrong payload hold.",
      dualControlRequestId: dual.value.id,
    });
    expect(substituted.ok).toBe(false);
    if (!substituted.ok) {
      expect(substituted.code).toBe("DUAL_CONTROL_PAYLOAD_MISMATCH");
    }

    const bypass = await releaseLegalHold(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      holdId: hold.value.id,
      reason: "Missing dual control id.",
      dualControlRequestId: "",
    });
    expect(bypass.ok).toBe(false);
    if (!bypass.ok) {
      expect(bypass.code).toBe("DUAL_CONTROL_REQUIRED");
    }

    const released = await releaseLegalHold(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      holdId: hold.value.id,
      reason: "Release after dual control.",
      dualControlRequestId: dual.value.id,
    });
    expect(released.ok).toBe(true);

    const replay = await releaseLegalHold(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      holdId: hold.value.id,
      reason: "Replay release.",
      dualControlRequestId: dual.value.id,
    });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.code).toBe("DUAL_CONTROL_ALREADY_EXECUTED");
    }

    const [dualRow] = await db
      .select()
      .from(dualControlRequests)
      .where(eq(dualControlRequests.id, dual.value.id));
    expect(dualRow?.status).toBe("executed");
  });

  it("rolls back privacy mutations when audit append fails", async () => {
    const spy = vi
      .spyOn(auditLog, "appendAuthAudit")
      .mockRejectedValue(new Error("forced audit failure"));

    const failedHold = await placeLegalHold(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      subjectType: "account",
      subjectId: "account-ostt-synth-privacy-admin-c",
      reason: "Should roll back.",
    });
    expect(failedHold.ok).toBe(false);

    const holds = await db
      .select()
      .from(legalHolds)
      .where(
        eq(legalHolds.subjectId, "account-ostt-synth-privacy-admin-c"),
      );
    expect(holds.filter((row) => row.releasedAt == null)).toHaveLength(0);

    spy.mockRestore();
  });

  it("serializes concurrent hold placement against closure", async () => {
    const personId = newEntityId("person");
    const accountId = "account-ostt-synth-privacy-race";
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth race",
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: "race@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const requested = await requestAccountClosure(db, {
      accountId,
      actorAccountId: accountId,
      reason: "Race fixture request.",
    });
    expect(requested.ok).toBe(true);
    if (!requested.ok) {
      return;
    }

    const dual = await requestDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      action: "privacy.execute_closure",
      payload: {
        workflow: "account_request",
        accountId,
        deletionRequestId: requested.value.requestId,
      },
      reason: "Race closure dual control.",
    });
    expect(dual.ok).toBe(true);
    if (!dual.ok) {
      return;
    }
    await approveDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      requestId: dual.value.id,
      reason: "Approve race closure.",
    });

    const [holdResult, closeResult] = await Promise.all([
      placeLegalHold(db, {
        actorAccountId: "account-ostt-synth-privacy-admin-a",
        subjectType: "account",
        subjectId: accountId,
        reason: "Concurrent hold vs closure.",
      }),
      executeAccountClosure(db, {
        accountId,
        actorAccountId: "account-ostt-synth-privacy-admin-b",
        reason: "Concurrent closure vs hold.",
        dualControlRequestId: dual.value.id,
        workflow: "account_request",
        deletionRequestId: requested.value.requestId,
      }),
    ]);

    // Exactly one institutional outcome: either closed without active hold, or
    // hold placed and closure blocked (or closure won then hold can still place
    // on a closed account — hold may succeed after close). Assert mutual exclusion
    // of "closed while hold was active at commit".
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    const held = await hasActiveLegalHold(db, "account", accountId);

    if (closeResult.ok) {
      expect(account?.lifecycleState).toBe("closed");
      // If closure won, a later hold may still exist; both ops cannot have
      // succeeded with hold blocking closure in the same race without serialization.
      expect(holdResult.ok || held).toBeTruthy();
    } else {
      expect(closeResult.code).toBe("CLOSURE_BLOCKED_BY_HOLD");
      expect(holdResult.ok).toBe(true);
      expect(held).toBe(true);
      expect(account?.lifecycleState).not.toBe("closed");
    }
  });

  it("rejects deletion requests that do not belong to the target account", async () => {
    const personA = newEntityId("person");
    const personB = newEntityId("person");
    const accountA = "account-ostt-synth-privacy-close-a";
    const accountB = "account-ostt-synth-privacy-close-b";
    await db.insert(persons).values([
      { id: personA, synthetic: true, displayLabel: "ostt-synth close-a" },
      { id: personB, synthetic: true, displayLabel: "ostt-synth close-b" },
    ]);
    await db.insert(accounts).values([
      {
        id: accountA,
        personId: personA,
        contactChannel: "close-a@ostt.synth.test",
        lifecycleState: "active",
        synthetic: true,
        contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
        activatedAt: new Date("2026-08-02T00:00:00.000Z"),
      },
      {
        id: accountB,
        personId: personB,
        contactChannel: "close-b@ostt.synth.test",
        lifecycleState: "active",
        synthetic: true,
        contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
        activatedAt: new Date("2026-08-02T00:00:00.000Z"),
      },
    ]);

    const reqA = await requestAccountClosure(db, {
      accountId: accountA,
      actorAccountId: accountA,
      reason: "A requests closure.",
    });
    const reqB = await requestAccountClosure(db, {
      accountId: accountB,
      actorAccountId: accountB,
      reason: "B requests closure.",
    });
    expect(reqA.ok && reqB.ok).toBe(true);
    if (!reqA.ok || !reqB.ok) {
      return;
    }

    const dual = await requestDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      action: "privacy.execute_closure",
      payload: {
        workflow: "account_request",
        accountId: accountA,
        deletionRequestId: reqB.value.requestId,
      },
      reason: "Malformed cross-account payload.",
    });
    expect(dual.ok).toBe(true);
    if (!dual.ok) {
      return;
    }
    await approveDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      requestId: dual.value.id,
      reason: "Approve malformed payload for negative test.",
    });

    const mismatched = await executeAccountClosure(db, {
      accountId: accountA,
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      reason: "Must not close A using B’s request.",
      dualControlRequestId: dual.value.id,
      workflow: "account_request",
      deletionRequestId: reqB.value.requestId,
    });
    expect(mismatched.ok).toBe(false);
    if (!mismatched.ok) {
      expect(mismatched.code).toBe("CLOSURE_REQUEST_MISMATCH");
    }

    const [stillA, stillB] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.id, accountA)).then((r) => r[0]),
      db.select().from(accounts).where(eq(accounts.id, accountB)).then((r) => r[0]),
    ]);
    expect(stillA?.lifecycleState).toBe("active");
    expect(stillB?.lifecycleState).toBe("active");

    const [reqBRow] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, reqB.value.requestId));
    expect(reqBRow?.status).toBe("pending");
  });

  it("supports distinct administrator_initiated closure without a deletion request", async () => {
    const personId = newEntityId("person");
    const accountId = "account-ostt-synth-privacy-admin-close";
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth admin-close",
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: "admin-close@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const withRequestId = await executeAccountClosure(db, {
      accountId,
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      reason: "Admin workflow cannot carry a deletion request id.",
      dualControlRequestId: "dual_unused",
      workflow: "administrator_initiated",
      deletionRequestId: "delreq_should_be_rejected",
    });
    expect(withRequestId.ok).toBe(false);
    if (!withRequestId.ok) {
      expect(withRequestId.code).toBe("CLOSURE_WORKFLOW_INVALID");
    }

    const dual = await requestDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      action: "privacy.execute_closure",
      payload: { workflow: "administrator_initiated", accountId },
      reason: "Administrator-initiated closure.",
    });
    expect(dual.ok).toBe(true);
    if (!dual.ok) {
      return;
    }
    await approveDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      requestId: dual.value.id,
      reason: "Approve admin-initiated closure.",
    });

    const logSpy = vi.spyOn(securityLogModule, "securityLog");
    const closed = await executeAccountClosure(db, {
      accountId,
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      reason: "Administrator-initiated closure drill.",
      dualControlRequestId: dual.value.id,
      workflow: "administrator_initiated",
    });
    expect(closed.ok).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "privacy.account_closed",
        subjectRef: expect.stringMatching(/^subj_/),
      }),
    );
    const logged = JSON.stringify(logSpy.mock.calls);
    expect(logged).not.toContain(accountId);
    logSpy.mockRestore();
  });

  it("does not emit a success security log when closure rolls back", async () => {
    const personId = newEntityId("person");
    const accountId = "account-ostt-synth-privacy-log-rollback";
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth log-rollback",
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: "log-rollback@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const dual = await requestDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      action: "privacy.execute_closure",
      payload: { workflow: "administrator_initiated", accountId },
      reason: "Rollback log drill.",
    });
    expect(dual.ok).toBe(true);
    if (!dual.ok) {
      return;
    }
    await approveDualControl(db, {
      actorAccountId: "account-ostt-synth-privacy-admin-b",
      requestId: dual.value.id,
      reason: "Approve for rollback log drill.",
    });

    const auditSpy = vi
      .spyOn(auditLog, "appendAuthAudit")
      .mockRejectedValue(new Error("forced audit failure"));
    const logSpy = vi.spyOn(securityLogModule, "securityLog");

    const failed = await executeAccountClosure(db, {
      accountId,
      actorAccountId: "account-ostt-synth-privacy-admin-a",
      reason: "Should roll back before security log.",
      dualControlRequestId: dual.value.id,
      workflow: "administrator_initiated",
    });
    expect(failed.ok).toBe(false);
    expect(
      logSpy.mock.calls.some(
        (call) => call[0]?.event === "privacy.account_closed",
      ),
    ).toBe(false);

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    expect(account?.lifecycleState).toBe("active");

    auditSpy.mockRestore();
    logSpy.mockRestore();
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
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toMatch(
      /frame-ancestors 'none'/,
    );

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
  });
});
