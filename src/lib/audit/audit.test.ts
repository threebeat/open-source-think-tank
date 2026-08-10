import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createTestDatabase } from "@/db/pglite";
import { accounts, auditEvents, persons, roleAssignments } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { newEntityId } from "@/lib/auth/tokens";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import {
  listPublicAuditFeed,
  searchRestrictedAudit,
  verifyAuditContinuity,
} from "@/lib/audit/ledger";
import {
  assertNoProhibitedPublicFields,
  projectAuditEventPublic,
} from "@/lib/audit/project-public";
import { L2_KINDS, seedApprovedAssertions } from "@/lib/verification/seed-assurance";

describe("audit ledger (2.9)", () => {
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
      displayLabel: "ostt-synth auditor",
    });
    await db.insert(accounts).values({
      id: "account-ostt-synth-audit-reader",
      personId,
      contactChannel: "audit-reader@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await db.insert(roleAssignments).values({
      id: newEntityId("role"),
      accountId: "account-ostt-synth-audit-reader",
      role: "auditor",
      grantedByLabel: "ostt-synth-audit-test",
      reason: "Restricted audit search fixture.",
    });
    await seedApprovedAssertions(
      db,
      "account-ostt-synth-audit-reader",
      L2_KINDS,
    );
  }, 120_000);

  afterAll(async () => {
    await client.close();
  });

  it("chains continuity hashes and verifies continuity", async () => {
    await appendAuthAudit(db, {
      actorRole: "administrator",
      actorAccountId: "account-ostt-synth-ben",
      action: "assent.document_published",
      subjectType: "document_version",
      subjectId: "doc-ostt-synth-privacy-v1",
      summary: "Private publish summary with alice@example.com must stay private.",
      privatePayload: { kind: "privacy_notice" },
      synthetic: true,
    });
    await appendAuthAudit(db, {
      actorRole: "administrator",
      actorAccountId: "account-ostt-synth-ben",
      action: "authz.platform_role_granted",
      subjectType: "account",
      subjectId: "account-ostt-synth-ada",
      summary: "Private role grant mentioning account-ostt-synth-ada.",
      reason: "Synthetic continuity fixture.",
      privatePayload: { role: "participant" },
      synthetic: true,
    });

    const continuity = await verifyAuditContinuity(db);
    expect(continuity.ok).toBe(true);
    expect(continuity.checked).toBeGreaterThan(2);
  });

  it("rejects unregistered actions", async () => {
    await expect(
      appendAuthAudit(db, {
        actorRole: "system",
        action: "auth.not_a_real_action",
        subjectType: "test",
        subjectId: "x",
        summary: "should fail",
        synthetic: true,
      }),
    ).rejects.toThrow(/AUDIT_UNREGISTERED_ACTION/);
  });

  it("projects registry templates only and blocks sensitive values", async () => {
    await appendAuthAudit(db, {
      actorRole: "administrator",
      actorAccountId: "account-ostt-synth-ben",
      action: "assent.document_published",
      subjectType: "document_version",
      subjectId: "doc-leak-check",
      summary:
        "Caller summary with alice@example.com, account-ostt-synth-ada, ostt:vhold:abc123, and political-opinion text.",
      privatePayload: {
        kind: "privacy_notice",
        email: "alice@example.com",
        accountId: "account-ostt-synth-ada",
        artifact: "ostt:vhold:abc123",
        token: "eyJhbGciOiJIUzI1NiJ9.aaaa.bbbb",
        opinion: "political-opinion: expand suffrage",
      },
      synthetic: true,
    });

    const publicFeed = await listPublicAuditFeed(db, 100);
    for (const row of publicFeed) {
      assertNoProhibitedPublicFields(row);
      expect(row.summary).not.toContain("alice@example.com");
      expect(row.summary).not.toContain("account-ostt-synth-ada");
      expect(row.summary).not.toContain("ostt:vhold:");
      expect(row.summary).not.toContain("eyJhbGciOi");
      expect(row.summary).not.toContain("political-opinion");
      expect(JSON.stringify(row)).not.toContain("alice@example.com");
      expect(JSON.stringify(row)).not.toContain("account-ostt-synth-ada");
    }

    const published = publicFeed.filter(
      (row) => row.action === "assent.document_published",
    );
    expect(published.length).toBeGreaterThan(0);
    expect(
      published.every((row) =>
        /document version was published/i.test(row.summary),
      ),
    ).toBe(true);

    const nonPublic = projectAuditEventPublic(
      {
        id: "x",
        at: new Date(),
        actorRole: "x",
        actorAccountId: null,
        action: "assent.recorded",
        subjectType: "assent_record",
        subjectId: "assent-secret",
        summary: "Private assent must not project publicly.",
        requestCorrelationId: null,
        reason: null,
        privatePayload: { accountId: "account-ostt-synth-ada" },
        continuityPrevHash: null,
        continuityHash: "abc",
        synthetic: true,
        createdAt: new Date(),
      },
      { prevHash: null, hash: "abc" },
    );
    expect(nonPublic).toBeNull();
  });

  it("serializes concurrent appends without forking the chain", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        appendAuthAudit(db, {
          actorRole: "system",
          action: "auth.test_synthetic_marker",
          subjectType: "test",
          subjectId: `concurrent-${index}`,
          summary: `Concurrent append ${index}`,
          synthetic: true,
        }),
      ),
    );

    const prevHashes = results.map((row) => row.continuityPrevHash);
    const hashes = results.map((row) => row.continuityHash);
    expect(new Set(hashes).size).toBe(results.length);
    // Each non-null prev must appear as exactly one continuityHash (no shared predecessor).
    for (const prev of prevHashes) {
      if (prev == null) {
        continue;
      }
      expect(hashes.filter((hash) => hash === prev).length).toBeLessThanOrEqual(1);
    }

    const continuity = await verifyAuditContinuity(db, { pageSize: 3 });
    expect(continuity.ok).toBe(true);
  });

  async function expectTamperDetected(
    id: string,
    patch: Partial<typeof auditEvents.$inferInsert>,
  ) {
    const [before] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.id, id))
      .limit(1);
    expect(before).toBeTruthy();

    await db.execute(sql`ALTER TABLE audit_events DISABLE TRIGGER audit_events_immutable`);
    await db.update(auditEvents).set(patch).where(eq(auditEvents.id, id));
    await db.execute(sql`ALTER TABLE audit_events ENABLE TRIGGER audit_events_immutable`);

    const continuity = await verifyAuditContinuity(db);
    expect(continuity.ok).toBe(false);
    expect(continuity.breakAtId).toBe(id);
    expect(continuity.reason).toBe("digest_mismatch");

    await db.execute(sql`ALTER TABLE audit_events DISABLE TRIGGER audit_events_immutable`);
    await db
      .update(auditEvents)
      .set({
        actorRole: before!.actorRole,
        at: before!.at,
        summary: before!.summary,
        privatePayload: before!.privatePayload,
        synthetic: before!.synthetic,
      })
      .where(eq(auditEvents.id, id));
    await db.execute(sql`ALTER TABLE audit_events ENABLE TRIGGER audit_events_immutable`);
  }

  it("detects summary, actor-role, timestamp, payload, and classification tampering", async () => {
    const appended = await appendAuthAudit(db, {
      actorRole: "system",
      action: "auth.test_synthetic_marker",
      subjectType: "test",
      subjectId: "tamper-target",
      summary: "Untampered summary",
      privatePayload: { marker: "untampered-payload" },
      synthetic: true,
    });

    await expectTamperDetected(appended.id, {
      summary: "Tampered summary value",
    });
    await expectTamperDetected(appended.id, {
      actorRole: "administrator",
    });
    await expectTamperDetected(appended.id, {
      at: new Date("2099-01-01T00:00:00.000Z"),
    });
    await expectTamperDetected(appended.id, {
      privatePayload: { marker: "tampered-payload" },
    });
    await expectTamperDetected(appended.id, {
      synthetic: false,
    });

    const healthy = await verifyAuditContinuity(db);
    expect(healthy.ok).toBe(true);
  });

  it("detects continuity forks", async () => {
    const parent = await appendAuthAudit(db, {
      actorRole: "system",
      action: "auth.test_synthetic_marker",
      subjectType: "test",
      subjectId: "fork-parent",
      summary: "Parent for fork fixture",
      synthetic: true,
    });
    await appendAuthAudit(db, {
      actorRole: "system",
      action: "auth.test_synthetic_marker",
      subjectType: "test",
      subjectId: "fork-legitimate-child",
      summary: "Legitimate child",
      synthetic: true,
    });

    await db.execute(sql`ALTER TABLE audit_events DISABLE TRIGGER audit_events_immutable`);
    const forkId = newEntityId("audit");
    await db.insert(auditEvents).values({
      id: forkId,
      actorRole: "system",
      action: "auth.test_synthetic_marker",
      subjectType: "test",
      subjectId: "fork-sibling",
      summary: "Forked sibling sharing predecessor",
      continuityPrevHash: parent.continuityHash,
      continuityHash: "deadbeef".repeat(8),
      synthetic: true,
      // Ensure it appears after the legitimate child in (at, id) order.
      at: new Date(Date.now() + 60_000),
    });
    await db.execute(sql`ALTER TABLE audit_events ENABLE TRIGGER audit_events_immutable`);

    const continuity = await verifyAuditContinuity(db);
    expect(continuity.ok).toBe(false);
    expect(continuity.reason).toBe("fork_detected");
  });

  it("restricts audit search and omits private payloads", async () => {
    const denied = await searchRestrictedAudit(
      db,
      "account-ostt-synth-ada",
      { query: "Synthetic" },
    );
    expect(denied.ok).toBe(false);

    const allowed = await searchRestrictedAudit(
      db,
      "account-ostt-synth-audit-reader",
      { query: "Synthetic" },
    );
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(
        allowed.value.every(
          (row) => !("privatePayload" in row) && !("evidencePointer" in row),
        ),
      ).toBe(true);
    }
  });
});
