import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  auditEvents,
  conversationPseudonyms,
  persons,
  roleAssignments,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import * as auditLog from "@/lib/auth/audit-log";
import { authorize } from "@/lib/authz/authorize";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { newEntityId } from "@/lib/auth/tokens";
import {
  moderatorReverseLookupDenied,
  privilegedLookupAccountByPseudonym,
} from "@/lib/pseudonym/privileged-lookup";
import {
  PRIVILEGED_LOOKUP_SCOPE,
  PSEUDONYM_RULES,
} from "@/lib/pseudonym/rules";
import {
  deleteConversationPseudonym,
  issueConversationPseudonym,
  rotateConversationPseudonym,
} from "@/lib/pseudonym/service";
import { L3_KINDS, seedApprovedAssertions } from "@/lib/verification/seed-assurance";

describe("conversation-scoped pseudonyms (2.10/2.11 hardening)", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_pseudonym_test";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);

    const personId = newEntityId("person");
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth auditor-l3",
    });
    await db.insert(accounts).values({
      id: "account-ostt-synth-pseudo-auditor",
      personId,
      contactChannel: "pseudo-auditor@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await db.insert(roleAssignments).values({
      id: newEntityId("role"),
      accountId: "account-ostt-synth-pseudo-auditor",
      role: "auditor",
      grantedByLabel: "ostt-synth-pseudo-test",
      reason: "Privileged lookup fixture.",
    });
    await seedApprovedAssertions(
      db,
      "account-ostt-synth-pseudo-auditor",
      L3_KINDS,
    );
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

  it("documents operational rules and privileged lookup scope", () => {
    expect(PSEUDONYM_RULES.reverseApis).toMatch(/moderator/i);
    expect(PRIVILEGED_LOOKUP_SCOPE.includeExpired).toBe(true);
    expect(PRIVILEGED_LOOKUP_SCOPE.includeRotated).toBe(true);
    expect(PRIVILEGED_LOOKUP_SCOPE.includeDeleted).toBe(false);
  });

  it("issues opaque per-conversation pseudonyms that cannot correlate across conversations", async () => {
    const convA = "ostt-synth-conversation-alpha";
    const convB = "ostt-synth-conversation-beta";

    const a = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId: convA,
      actorAccountId: "account-ostt-synth-ada",
    });
    const b = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId: convB,
      actorAccountId: "account-ostt-synth-ada",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) {
      return;
    }

    expect(a.value.pseudonym).not.toEqual(b.value.pseudonym);
    expect(a.value.pseudonym).not.toContain("account-ostt-synth-ada");
    expect(a.value.pseudonym.startsWith("cpsp_")).toBe(true);
  });

  it("requires a registered open conversation and approved purpose enum", async () => {
    const unregistered = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId: "ostt-synth-conversation-not-in-registry",
      actorAccountId: "account-ostt-synth-ada",
    });
    expect(unregistered.ok).toBe(false);
    if (!unregistered.ok) {
      expect(unregistered.code).toBe("PSEUDONYM_CONVERSATION_NOT_REGISTERED");
    }

    const badPurpose = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId: "ostt-synth-conversation-gamma",
      actorAccountId: "account-ostt-synth-ada",
      purpose: "live_opinion_collection",
    });
    expect(badPurpose.ok).toBe(false);
    if (!badPurpose.ok) {
      expect(badPurpose.code).toBe("PSEUDONYM_PURPOSE_INVALID");
    }
  });

  it("rolls back mapping changes when audit append fails", async () => {
    const spy = vi
      .spyOn(auditLog, "appendAuthAudit")
      .mockRejectedValue(new Error("forced audit failure"));

    const before = await db.select().from(conversationPseudonyms);
    const failed = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ben",
      conversationId: "ostt-synth-conversation-zeta",
      actorAccountId: "account-ostt-synth-ben",
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.code).toBe("PSEUDONYM_TX_FAILED");
    }

    const after = await db
      .select()
      .from(conversationPseudonyms)
      .where(
        and(
          eq(conversationPseudonyms.accountId, "account-ostt-synth-ben"),
          eq(
            conversationPseudonyms.conversationId,
            "ostt-synth-conversation-zeta",
          ),
        ),
      );
    expect(after).toHaveLength(0);
    expect(before.length).toBeLessThanOrEqual(
      (await db.select().from(conversationPseudonyms)).length,
    );

    spy.mockRestore();

    const rotateBase = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ben",
      conversationId: "ostt-synth-conversation-zeta",
      actorAccountId: "account-ostt-synth-ben",
    });
    expect(rotateBase.ok).toBe(true);
    if (!rotateBase.ok) {
      return;
    }

    const rotateSpy = vi
      .spyOn(auditLog, "appendAuthAudit")
      .mockRejectedValue(new Error("forced audit failure on rotate"));
    const rotateFailed = await rotateConversationPseudonym(db, {
      accountId: "account-ostt-synth-ben",
      conversationId: "ostt-synth-conversation-zeta",
      actorAccountId: "account-ostt-synth-ben",
      reason: "Should roll back",
    });
    expect(rotateFailed.ok).toBe(false);
    rotateSpy.mockRestore();

    const [stillActive] = await db
      .select()
      .from(conversationPseudonyms)
      .where(
        and(
          eq(conversationPseudonyms.id, rotateBase.value.id),
          isNull(conversationPseudonyms.rotatedAt),
          isNull(conversationPseudonyms.deletedAt),
        ),
      )
      .limit(1);
    expect(stillActive?.pseudonym).toBe(rotateBase.value.pseudonym);
  });

  it("serializes concurrent issuance and rotation on the same conversation", async () => {
    const conversationId = "ostt-synth-conversation-delta";
    const issued = await Promise.all([
      issueConversationPseudonym(db, {
        accountId: "account-ostt-synth-ada",
        conversationId,
        actorAccountId: "account-ostt-synth-ada",
      }),
      issueConversationPseudonym(db, {
        accountId: "account-ostt-synth-ada",
        conversationId,
        actorAccountId: "account-ostt-synth-ada",
      }),
    ]);
    expect(issued.every((row) => row.ok)).toBe(true);
    if (!issued[0]?.ok || !issued[1]?.ok) {
      return;
    }
    expect(issued[0].value.pseudonym).toBe(issued[1].value.pseudonym);

    const rotations = await Promise.all([
      rotateConversationPseudonym(db, {
        accountId: "account-ostt-synth-ada",
        conversationId,
        actorAccountId: "account-ostt-synth-ada",
        reason: "Concurrent rotation A",
      }),
      rotateConversationPseudonym(db, {
        accountId: "account-ostt-synth-ada",
        conversationId,
        actorAccountId: "account-ostt-synth-ada",
        reason: "Concurrent rotation B",
      }),
    ]);
    // Serialized rotations may both succeed (A→B then B→C) or one may miss.
    expect(rotations.some((row) => row.ok)).toBe(true);
    const active = await db
      .select()
      .from(conversationPseudonyms)
      .where(
        and(
          eq(conversationPseudonyms.conversationId, conversationId),
          eq(conversationPseudonyms.accountId, "account-ostt-synth-ada"),
          isNull(conversationPseudonyms.deletedAt),
          isNull(conversationPseudonyms.rotatedAt),
        ),
      );
    expect(active).toHaveLength(1);
  });

  it("audits issuance and privileged lookup; denies moderator reverse paths", async () => {
    const issued = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ben",
      conversationId: "ostt-synth-conversation-epsilon",
      actorAccountId: "account-ostt-synth-ben",
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }

    const issueAudits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "pseudonym.issued"));
    expect(issueAudits.length).toBeGreaterThan(0);
    expect(JSON.stringify(issueAudits).includes(issued.value.pseudonym)).toBe(
      false,
    );

    expect(moderatorReverseLookupDenied().ok).toBe(false);

    const personId = newEntityId("person");
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: "ostt-synth moderator-pseudo",
    });
    await db.insert(accounts).values({
      id: "account-ostt-synth-pseudo-mod",
      personId,
      contactChannel: "pseudo-mod@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await db.insert(roleAssignments).values({
      id: newEntityId("role"),
      accountId: "account-ostt-synth-pseudo-mod",
      role: "moderator",
      grantedByLabel: "ostt-synth-pseudo-test",
      reason: "Moderator reverse-denial fixture.",
    });
    const mod = await loadPrincipal(db, "account-ostt-synth-pseudo-mod");
    expect(authorize(mod, "pseudonym.privileged_lookup").ok).toBe(false);

    const lookup = await privilegedLookupAccountByPseudonym(db, {
      actorAccountId: "account-ostt-synth-pseudo-auditor",
      pseudonym: issued.value.pseudonym,
      reason: "Synthetic incident re-identification drill.",
    });
    expect(lookup.ok).toBe(true);
    if (lookup.ok) {
      expect(lookup.value.accountId).toBe("account-ostt-synth-ben");
      expect(lookup.value.mappingState).toBe("active");
    }
  });

  it("allows privileged lookup of expired/rotated mappings but withholds deleted", async () => {
    const conversationId = "ostt-synth-conversation-gamma";
    const issued = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ben",
      conversationId,
      actorAccountId: "account-ostt-synth-ben",
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }

    await db
      .update(conversationPseudonyms)
      .set({
        issuedAt: new Date("2019-01-01T00:00:00.000Z"),
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      })
      .where(eq(conversationPseudonyms.id, issued.value.id));

    const expiredLookup = await privilegedLookupAccountByPseudonym(db, {
      actorAccountId: "account-ostt-synth-pseudo-auditor",
      pseudonym: issued.value.pseudonym,
      reason: "Expired mapping incident drill.",
    });
    expect(expiredLookup.ok).toBe(true);
    if (expiredLookup.ok) {
      expect(expiredLookup.value.mappingState).toBe("expired");
    }

    // Restore expiry so rotation path can use an active row.
    await db
      .update(conversationPseudonyms)
      .set({ expiresAt: new Date(Date.now() + 86_400_000) })
      .where(eq(conversationPseudonyms.id, issued.value.id));

    const rotated = await rotateConversationPseudonym(db, {
      accountId: "account-ostt-synth-ben",
      conversationId,
      actorAccountId: "account-ostt-synth-ben",
      reason: "Rotation for historical lookup drill.",
    });
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) {
      return;
    }

    const rotatedLookup = await privilegedLookupAccountByPseudonym(db, {
      actorAccountId: "account-ostt-synth-pseudo-auditor",
      pseudonym: issued.value.pseudonym,
      reason: "Rotated mapping incident drill.",
    });
    expect(rotatedLookup.ok).toBe(true);
    if (rotatedLookup.ok) {
      expect(rotatedLookup.value.mappingState).toBe("rotated");
    }

    const deleted = await deleteConversationPseudonym(db, {
      accountId: "account-ostt-synth-ben",
      conversationId,
      actorAccountId: "account-ostt-synth-ben",
      reason: "Deletion withhold drill.",
    });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok || !rotated.ok) {
      return;
    }

    const withheld = await privilegedLookupAccountByPseudonym(db, {
      actorAccountId: "account-ostt-synth-pseudo-auditor",
      pseudonym: rotated.value.pseudonym,
      reason: "Deleted mapping must be withheld.",
    });
    expect(withheld.ok).toBe(false);
    if (!withheld.ok) {
      expect(withheld.code).toBe("PSEUDONYM_DELETED_WITHHELD");
    }
  });

  it("enforces expires_at > issued_at at the database", async () => {
    await expect(
      db.execute(sql`
        INSERT INTO conversation_pseudonyms (
          id, conversation_id, account_id, pseudonym, purpose,
          issued_at, expires_at, synthetic
        ) VALUES (
          'cpsp_invalid_expiry',
          'ostt-synth-conversation-alpha',
          'account-ostt-synth-ada',
          'cpsp_invalid_expiry_token',
          'closed_test_consultation',
          '2026-08-02T00:00:00.000Z',
          '2026-08-01T00:00:00.000Z',
          true
        )
      `),
    ).rejects.toThrow();
  });
});
