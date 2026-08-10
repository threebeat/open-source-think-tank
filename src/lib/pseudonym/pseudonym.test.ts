import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createTestDatabase } from "@/db/pglite";
import { accounts, auditEvents, persons, roleAssignments } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { authorize } from "@/lib/authz/authorize";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { newEntityId } from "@/lib/auth/tokens";
import {
  moderatorReverseLookupDenied,
  privilegedLookupAccountByPseudonym,
} from "@/lib/pseudonym/privileged-lookup";
import { PSEUDONYM_RULES } from "@/lib/pseudonym/rules";
import {
  deleteConversationPseudonym,
  issueConversationPseudonym,
  rotateConversationPseudonym,
} from "@/lib/pseudonym/service";
import { L3_KINDS, seedApprovedAssertions } from "@/lib/verification/seed-assurance";

describe("conversation-scoped pseudonyms (2.10)", () => {
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

  it("documents operational rules for rotation, deletion, export, and incident access", () => {
    expect(PSEUDONYM_RULES.reverseApis).toMatch(/moderator/i);
    expect(PSEUDONYM_RULES.export).toMatch(/own conversation pseudonyms/i);
    expect(PSEUDONYM_RULES.incidentAccess).toMatch(/privileged lookup/i);
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
    expect(a.value.pseudonym).not.toContain("ada@");
    expect(a.value.pseudonym.startsWith("cpsp_")).toBe(true);

    // Re-issue returns the same active mapping within a conversation.
    const again = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId: convA,
      actorAccountId: "account-ostt-synth-ada",
    });
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.pseudonym).toBe(a.value.pseudonym);
    }
  });

  it("rejects non-closed-test conversation ids and cross-account issuance", async () => {
    const live = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId: "live-polis-conversation",
      actorAccountId: "account-ostt-synth-ada",
    });
    expect(live.ok).toBe(false);
    if (!live.ok) {
      expect(live.code).toBe("PSEUDONYM_CONVERSATION_NOT_CLOSED_TEST");
    }

    const cross = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId: "ostt-synth-conversation-gamma",
      actorAccountId: "account-ostt-synth-ben",
    });
    expect(cross.ok).toBe(false);
    if (!cross.ok) {
      expect(cross.code).toBe("PSEUDONYM_SELF_ONLY");
    }
  });

  it("audits issuance and privileged lookup; denies moderator reverse paths", async () => {
    const issued = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ben",
      conversationId: "ostt-synth-conversation-delta",
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
    expect(
      JSON.stringify(issueAudits).includes(issued.value.pseudonym),
    ).toBe(false);

    const modDenied = moderatorReverseLookupDenied();
    expect(modDenied.ok).toBe(false);

    // Seed a moderator principal denial via authorize (role matrix).
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
      expect(lookup.value.conversationId).toBe(
        "ostt-synth-conversation-delta",
      );
    }

    const lookupAudits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "pseudonym.privileged_lookup"));
    expect(lookupAudits.some((row) => row.reason?.includes("incident"))).toBe(
      true,
    );
  });

  it("rotates and deletes with audit, without reusing deleted identifiers", async () => {
    const conversationId = "ostt-synth-conversation-epsilon";
    const first = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId,
      actorAccountId: "account-ostt-synth-ada",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const rotated = await rotateConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId,
      actorAccountId: "account-ostt-synth-ada",
      reason: "Synthetic rotation drill.",
    });
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) {
      return;
    }
    expect(rotated.value.pseudonym).not.toBe(first.value.pseudonym);

    const deleted = await deleteConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId,
      actorAccountId: "account-ostt-synth-ada",
      reason: "Synthetic deletion drill.",
    });
    expect(deleted.ok).toBe(true);

    const reissue = await issueConversationPseudonym(db, {
      accountId: "account-ostt-synth-ada",
      conversationId,
      actorAccountId: "account-ostt-synth-ada",
    });
    expect(reissue.ok).toBe(true);
    if (reissue.ok) {
      expect(reissue.value.pseudonym).not.toBe(first.value.pseudonym);
      expect(reissue.value.pseudonym).not.toBe(rotated.value.pseudonym);
    }
  });
});
