import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { accounts, persons, roleAssignments } from "@/db/schema";
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
      actorAccountId: null,
      action: "assent.document_published",
      subjectType: "document_version",
      subjectId: "doc-ostt-synth-privacy-v1",
      summary: "Synthetic public-projectable document publish audit.",
      synthetic: true,
    });
    await appendAuthAudit(db, {
      actorRole: "administrator",
      actorAccountId: null,
      action: "authz.platform_role_granted",
      subjectType: "account",
      subjectId: "account-ostt-synth-ada",
      summary: "Synthetic role grant summary without account identifiers.",
      privatePayload: { role: "participant" },
      synthetic: true,
    });

    const continuity = await verifyAuditContinuity(db, 1000);
    expect(continuity.ok).toBe(true);
  });

  it("never projects prohibited fields to the public feed", async () => {
    await appendAuthAudit(db, {
      actorRole: "account_holder",
      actorAccountId: "account-ostt-synth-ada",
      action: "assent.recorded",
      subjectType: "assent_record",
      subjectId: "assent-secret",
      summary: "Private assent must not project publicly.",
      privatePayload: {
        accountId: "account-ostt-synth-ada",
        evidencePointer: "ostt:vhold:secret",
      },
      synthetic: true,
    });

    const publicFeed = await listPublicAuditFeed(db, 100);
    for (const row of publicFeed) {
      assertNoProhibitedPublicFields(row);
      expect(row.action).not.toBe("assent.recorded");
      expect(JSON.stringify(row)).not.toContain("evidencePointer");
      expect(JSON.stringify(row)).not.toContain("account-ostt-synth-ada");
    }

    const blocked = projectAuditEventPublic(
      {
        id: "x",
        at: new Date(),
        actorRole: "x",
        actorAccountId: null,
        action: "assent.document_published",
        subjectType: "document_version",
        subjectId: "doc",
        summary: "ok",
        requestCorrelationId: null,
        reason: null,
        privatePayload: { accountId: "secret" },
        continuityPrevHash: null,
        continuityHash: "abc",
        synthetic: true,
        createdAt: new Date(),
      },
      { prevHash: null, hash: "abc" },
    );
    expect(blocked).toBeNull();
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
