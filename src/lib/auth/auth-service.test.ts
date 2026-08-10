import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  auditEvents,
  authChallenges,
  invitations,
  persons,
} from "@/db/schema";
import {
  SYNTHETIC_PENDING_INVITE_CONTACT,
  SYNTHETIC_PENDING_INVITE_TOKEN,
  seedSyntheticFoundation,
} from "@/db/seeds/synthetic";
import type { EmailAdapter, EmailMessage } from "@/lib/adapters/email";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { AuthService, countOpenChallenges } from "@/lib/auth/auth-service";
import { canExerciseActiveCapability } from "@/lib/auth/capabilities";
import { assertAllowedLifecycleTransition } from "@/lib/auth/lifecycle";
import { resetRateLimits } from "@/lib/auth/rate-limit";
import { hashToken, newEntityId } from "@/lib/auth/tokens";
import { CaptureEmailAdapter } from "@/lib/email/capture-email-adapter";

function extractToken(textBody: string): string {
  const match = textBody.match(/token=([^&\s]+)/);
  if (!match?.[1]) {
    throw new Error("challenge token missing from email body");
  }
  return decodeURIComponent(match[1]);
}

class FailingEmailAdapter implements EmailAdapter {
  readonly name = "email" as const;
  calls = 0;

  async send(
    _message: EmailMessage,
  ): Promise<AdapterResult<{ messageId: string }>> {
    this.calls += 1;
    return {
      ok: false,
      error: "Simulated delivery failure",
      code: "EMAIL_DISABLED",
    };
  }
}

describe("AuthService lifecycle (synthetic)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let email: CaptureEmailAdapter;
  let service: AuthService;

  beforeAll(async () => {
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  beforeEach(() => {
    resetRateLimits();
    email = new CaptureEmailAdapter();
    service = new AuthService({
      db,
      email,
      appUrl: "http://127.0.0.1:3000",
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it("accepts a pending invite, verifies contact, and stays pending_onboarding", async () => {
    const accepted = await service.acceptInvite({
      inviteToken: SYNTHETIC_PENDING_INVITE_TOKEN,
      contactChannel: SYNTHETIC_PENDING_INVITE_CONTACT,
    });
    expect(accepted.ok).toBe(true);

    const challengeMail = email.lastTo(SYNTHETIC_PENDING_INVITE_CONTACT);
    expect(challengeMail).toBeTruthy();
    const token = extractToken(challengeMail!.textBody);

    const session = await service.completeChallenge(token);
    expect(session.ok).toBe(true);
    if (!session.ok) {
      return;
    }
    expect(session.value.lifecycleState).toBe("pending_onboarding");
    expect(session.value.synthetic).toBe(true);
    expect(canExerciseActiveCapability(session.value.lifecycleState)).toBe(
      false,
    );

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, session.value.accountId));
    expect(account?.lifecycleState).toBe("pending_onboarding");
    expect(account?.activatedAt).toBeNull();

    const [invite] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, "invite-ostt-synth-cory-pending"));
    expect(invite?.status).toBe("accepted");
    expect(invite?.acceptedAccountId).toBe(session.value.accountId);
  });

  it("rejects reused invite tokens", async () => {
    const again = await service.acceptInvite({
      inviteToken: SYNTHETIC_PENDING_INVITE_TOKEN,
      contactChannel: SYNTHETIC_PENDING_INVITE_CONTACT,
    });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.code).toBe("INVITE_INVALID");
    }
  });

  it("keeps an accepted invite recoverable when email delivery fails", async () => {
    const rawInvite = "ostt-synth-invite-token-dana-email-fail";
    const contact = "dana-email-fail@ostt.synth.test";
    await db.insert(invitations).values({
      id: "invite-ostt-synth-dana-email-fail",
      tokenHash: hashToken(rawInvite),
      intendedContactChannel: contact,
      status: "pending",
      synthetic: true,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      issuedByLabel: "ostt-synth-seeder",
    });

    const failing = new FailingEmailAdapter();
    const failingService = new AuthService({
      db,
      email: failing,
      appUrl: "http://127.0.0.1:3000",
    });

    const accepted = await failingService.acceptInvite({
      inviteToken: rawInvite,
      contactChannel: contact,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) {
      return;
    }
    expect(accepted.value.status).toBe("challenge_pending_delivery");
    expect(await countOpenChallenges(db, contact)).toBe(1);

    const [invite] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, "invite-ostt-synth-dana-email-fail"));
    expect(invite?.status).toBe("accepted");

    const capture = new CaptureEmailAdapter();
    const resendService = new AuthService({
      db,
      email: capture,
      appUrl: "http://127.0.0.1:3000",
    });
    const resent = await resendService.resendChallenge(contact);
    expect(resent.ok).toBe(true);
    if (!resent.ok) {
      return;
    }
    expect(resent.value.status).toBe("challenge_sent");
    const token = extractToken(capture.lastTo(contact)!.textBody);
    const session = await resendService.completeChallenge(token);
    expect(session.ok).toBe(true);
    if (session.ok) {
      expect(session.value.lifecycleState).toBe("pending_onboarding");
    }
  });

  it("allows only one session from concurrent challenge completion", async () => {
    const signIn = await service.requestSignIn("ben@ostt.synth.test");
    expect(signIn.ok).toBe(true);
    const token = extractToken(email.lastTo("ben@ostt.synth.test")!.textBody);

    const [first, second] = await Promise.all([
      service.completeChallenge(token),
      service.completeChallenge(token),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((result) => result.ok)).toHaveLength(1);
    expect(outcomes.filter((result) => !result.ok)).toHaveLength(1);
    const failed = outcomes.find((result) => !result.ok);
    if (failed && !failed.ok) {
      expect(failed.code).toBe("AUTH_CHALLENGE_INVALID");
    }
  });

  it("revokes all sessions and rejects the prior session token", async () => {
    const signIn = await service.requestSignIn("ada@ostt.synth.test");
    expect(signIn.ok).toBe(true);
    const token = extractToken(email.lastTo("ada@ostt.synth.test")!.textBody);
    const established = await service.completeChallenge(token);
    expect(established.ok).toBe(true);
    if (!established.ok) {
      return;
    }

    await service.revokeAllSessions(established.value.accountId);
    const after = await service.getSessionByToken(
      established.value.rawSessionToken,
    );
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.value).toBeNull();
    }
  });

  it("classifies synthetic and real account audits correctly", async () => {
    const personId = newEntityId("person");
    const accountId = newEntityId("account");
    await db.insert(persons).values({
      id: personId,
      synthetic: false,
      displayLabel: "real account holder fixture",
      notes: "Non-synthetic fixture for audit classification tests only.",
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: "real-audit@example.test",
      lifecycleState: "pending_onboarding",
      synthetic: false,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    await service.revokeAllSessions(accountId);

    const realRows = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.subjectId, accountId));
    expect(realRows.length).toBeGreaterThan(0);
    expect(realRows.every((row) => row.synthetic === false)).toBe(true);

    await appendAuthAudit(db, {
      actorRole: "system",
      action: "auth.test_synthetic_marker",
      subjectType: "test",
      subjectId: "synth-marker",
      summary: "Synthetic classification marker.",
      synthetic: true,
    });
    const [synthMarker] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "auth.test_synthetic_marker"));
    expect(synthMarker?.synthetic).toBe(true);

    await expect(
      appendAuthAudit(db, {
        actorRole: "system",
        action: "auth.test_missing_synthetic",
        subjectType: "test",
        subjectId: "missing",
        summary: "Must require synthetic.",
        synthetic: undefined as unknown as boolean,
      }),
    ).rejects.toThrow(/explicit synthetic/);
  });

  it("never audits raw invite or challenge tokens", async () => {
    const rows = await db.select().from(auditEvents);
    const blob = JSON.stringify(rows);
    expect(blob).not.toContain(SYNTHETIC_PENDING_INVITE_TOKEN);
    expect(blob).not.toContain("token=");
  });

  it("refuses lifecycle transition to active in 2.4", () => {
    expect(() =>
      assertAllowedLifecycleTransition("pending_onboarding", "active"),
    ).toThrow(/activateAccount \(Work Package 2\.8\)/);
  });

  it("does not leave open challenges stranded after successful completion", async () => {
    const open = await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.contactChannel, "ben@ostt.synth.test"));
    expect(open.every((row) => row.consumedAt !== null)).toBe(true);
  });
});

describe("invite claim hashing helper", () => {
  it("matches seed token hashing", () => {
    expect(hashToken("ostt-synth-invite-token-cory")).toBe(
      createHash("sha256").update("ostt-synth-invite-token-cory").digest("hex"),
    );
  });
});
