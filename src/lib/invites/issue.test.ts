import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { accounts, auditEvents, invitations } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { hashToken } from "@/lib/auth/tokens";
import {
  issueParticipantInvitation,
  listIssuedInvitations,
} from "@/lib/invites/issue";
describe("invitation issuance (3.3)", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_invites";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
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

  it("issues hash-only invitations as synthetic when issuer is synthetic", async () => {
    const issued = await issueParticipantInvitation(db, {
      actorAccountId: "account-ostt-synth-staff-admin",
      intendedContactChannel: "  New.Person@ostt.synth.test ",
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }

    expect(issued.value.rawToken.length).toBeGreaterThan(20);
    expect(issued.value.acceptanceLink).toContain(issued.value.rawToken);

    const [row] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, issued.value.invitationId));
    expect(row?.tokenHash).toBe(hashToken(issued.value.rawToken));
    expect(row?.tokenHash).not.toBe(issued.value.rawToken);
    expect(row?.intendedContactChannel).toBe("new.person@ostt.synth.test");
    expect(row?.synthetic).toBe(true);
    expect(row?.kind).toBe("participant");
    expect(row?.issuedByAccountId).toBe("account-ostt-synth-staff-admin");

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.subjectId, issued.value.invitationId));
    expect(audit?.action).toBe("invites.issued");
    expect(JSON.stringify(audit)).not.toContain(issued.value.rawToken);
    expect(JSON.stringify(audit)).not.toContain(issued.value.acceptanceLink);
    expect(JSON.stringify(audit)).not.toContain("new.person@ostt.synth.test");
  });

  it("denies non-administrators and lists without tokens", async () => {
    const denied = await issueParticipantInvitation(db, {
      actorAccountId: "account-ostt-synth-ada",
      intendedContactChannel: "blocked@ostt.synth.test",
    });
    expect(denied.ok).toBe(false);

    const listed = await listIssuedInvitations(
      db,
      "account-ostt-synth-staff-admin",
    );
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(JSON.stringify(listed.value)).not.toMatch(/tokenHash|rawToken/);
      expect(
        listed.value.every((row) => row.contactRedacted.includes("***")),
      ).toBe(true);
    }
  });

  it("marks real administrator issuance as non-synthetic", async () => {
    await db
      .update(accounts)
      .set({ synthetic: false })
      .where(eq(accounts.id, "account-ostt-synth-staff-admin"));

    const issued = await issueParticipantInvitation(db, {
      actorAccountId: "account-ostt-synth-staff-admin",
      intendedContactChannel: "real-invitee@example.test",
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }

    const [row] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, issued.value.invitationId));
    expect(row?.synthetic).toBe(false);

    await db
      .update(accounts)
      .set({ synthetic: true })
      .where(eq(accounts.id, "account-ostt-synth-staff-admin"));
  });

  it("revokes prior pending invite for the same contact on reissue", async () => {
    const first = await issueParticipantInvitation(db, {
      actorAccountId: "account-ostt-synth-staff-admin",
      intendedContactChannel: "replace@ostt.synth.test",
    });
    const second = await issueParticipantInvitation(db, {
      actorAccountId: "account-ostt-synth-staff-admin",
      intendedContactChannel: "replace@ostt.synth.test",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    const [prior] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, first.value.invitationId));
    expect(prior?.status).toBe("revoked");

    const [next] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, second.value.invitationId));
    expect(next?.status).toBe("pending");
  });

  it("leaves at most one pending invitation under concurrent same-contact issuance", async () => {
    const contact = "concurrent-contact@ostt.synth.test";
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        issueParticipantInvitation(db, {
          actorAccountId: "account-ostt-synth-staff-admin",
          intendedContactChannel: contact,
        }),
      ),
    );

    const successes = results.filter((row) => row.ok);
    const failures = results.filter((row) => !row.ok);
    expect(successes.length).toBeGreaterThanOrEqual(1);
    expect(successes.length + failures.length).toBe(8);
    for (const failure of failures) {
      if (!failure.ok) {
        expect(failure.code).toMatch(/INVITE_ISSUE_CONFLICT|INVITE_ISSUE_FAILED/);
        expect(failure.error).not.toContain(contact);
        expect(JSON.stringify(failure)).not.toMatch(/token|http/i);
      }
    }

    const pending = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.kind, "participant"),
          eq(invitations.status, "pending"),
          eq(invitations.intendedContactChannel, contact),
        ),
      );
    expect(pending).toHaveLength(1);

    const historical = await db
      .select()
      .from(invitations)
      .where(eq(invitations.intendedContactChannel, contact));
    expect(historical.every((row) => row.status !== "pending" || row.id === pending[0]?.id)).toBe(
      true,
    );
    expect(historical.filter((row) => row.status === "revoked").length).toBeGreaterThanOrEqual(
      Math.max(0, successes.length - 1),
    );
  });
});
