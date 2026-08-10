import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { accounts, auditEvents, invitations } from "@/db/schema";
import {
  SYNTHETIC_PENDING_INVITE_CONTACT,
  SYNTHETIC_PENDING_INVITE_TOKEN,
  seedSyntheticFoundation,
} from "@/db/seeds/synthetic";
import { AuthService } from "@/lib/auth/auth-service";
import { assertAllowedLifecycleTransition } from "@/lib/auth/lifecycle";
import { resetRateLimits } from "@/lib/auth/rate-limit";
import { canExerciseActiveCapability } from "@/lib/auth/capabilities";
import { CaptureEmailAdapter } from "@/lib/email/capture-email-adapter";

function extractToken(textBody: string): string {
  const match = textBody.match(/token=([^&\s]+)/);
  if (!match?.[1]) {
    throw new Error("challenge token missing from email body");
  }
  return decodeURIComponent(match[1]);
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

  it("never audits raw invite or challenge tokens", async () => {
    const rows = await db.select().from(auditEvents);
    const blob = JSON.stringify(rows);
    expect(blob).not.toContain(SYNTHETIC_PENDING_INVITE_TOKEN);
    expect(blob).not.toContain("token=");
  });

  it("refuses lifecycle transition to active in 2.4", () => {
    expect(() =>
      assertAllowedLifecycleTransition("pending_onboarding", "active"),
    ).toThrow(/owned by 2\.8/);
  });
});
