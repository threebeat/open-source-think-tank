import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accountCredentials,
  accounts,
  organizationMembershipEvents,
  organizationMemberships,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { SYNTHETIC_ORG_ALPHA_ID } from "@/db/seeds/v2-organizations";
import { enrollOpenAccount, ENROLLMENT_MIN_FILL_MS } from "@/lib/auth/enrollment";
import { PRE_ALPHA_ASSIGNMENT_REASON } from "@/lib/auth/community-standards";
import { AuthService } from "@/lib/auth/auth-service";
import { resetRateLimits } from "@/lib/auth/rate-limit";
import { authorize } from "@/lib/authz/authorize";
import { authorizeOrganization } from "@/lib/authz/organization-context";
import { loadPrincipal } from "@/lib/authz/load-principal";

const FLAG_KEYS = [
  "APP_MODE",
  "DATABASE_URL",
  "COMMONHALL_V2_KERNEL",
  "COMMONHALL_V2_OPEN_ENROLLMENT",
  "AUTH_SECRET",
] as const;

describe("open enrollment", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  const previous: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of FLAG_KEYS) {
      previous[key] = process.env[key];
    }
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_synth";
    process.env.AUTH_SECRET = "ostt-synth-auth-secret-for-enrollment-tests";
    delete process.env.COMMONHALL_V2_KERNEL;
    delete process.env.COMMONHALL_V2_OPEN_ENROLLMENT;

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  beforeEach(() => {
    resetRateLimits();
  });

  afterEach(() => {
    process.env.COMMONHALL_V2_OPEN_ENROLLMENT = previous.COMMONHALL_V2_OPEN_ENROLLMENT;
    if (previous.COMMONHALL_V2_OPEN_ENROLLMENT === undefined) {
      delete process.env.COMMONHALL_V2_OPEN_ENROLLMENT;
    }
  });

  afterAll(async () => {
    await client.close();
    for (const key of FLAG_KEYS) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  function baseInput(identifier: string) {
    return {
      identifier,
      password: "a-sufficiently-long-pass",
      honeypot: "",
      formOpenedAt: Date.now() - ENROLLMENT_MIN_FILL_MS - 50,
      communityStandardsAssent: true,
      clientIp: "203.0.113.10",
    };
  }

  it("creates credentials, assignment, and an active community member without elevated authority", async () => {
    const result = await enrollOpenAccount(db, baseInput("alex@ostt.synth.test"));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.lifecycleState).toBe("active");
    expect(result.value.assignmentExplanation).toMatch(/Synthetic Alpha Hall/);
    expect(result.value.rawSessionToken.length).toBeGreaterThan(20);

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, result.value.accountId));
    expect(account?.enrollmentKind).toBe("open");
    expect(account?.lifecycleState).toBe("active");

    const [credential] = await db
      .select()
      .from(accountCredentials)
      .where(eq(accountCredentials.accountId, result.value.accountId));
    expect(credential?.passwordHash).toBeTruthy();
    expect(credential?.passwordHash).not.toBe("a-sufficiently-long-pass");
    expect(credential?.passwordScheme).toBe("scrypt_n32768");

    const memberships = await db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.accountId, result.value.accountId));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.organizationId).toBe(SYNTHETIC_ORG_ALPHA_ID);
    expect(memberships[0]?.status).toBe("active");
    expect(memberships[0]?.isPrimary).toBe(true);

    const events = await db
      .select()
      .from(organizationMembershipEvents)
      .where(eq(organizationMembershipEvents.accountId, result.value.accountId));
    expect(events.map((row) => row.eventKind)).toContain("assignment");
    expect(events[0]?.reason).toBe(PRE_ALPHA_ASSIGNMENT_REASON);

    const principal = await loadPrincipal(db, result.value.accountId);
    expect(principal).toBeTruthy();
    expect(authorize(principal, "organization.appointment.grant").ok).toBe(false);
    expect(
      authorizeOrganization(
        principal,
        SYNTHETIC_ORG_ALPHA_ID,
        "organization.appointment.grant",
      ).ok,
    ).toBe(false);
    expect(principal?.councilRoles).toEqual([]);
    expect(principal?.organizationAppointments).toEqual([]);
  });

  it("signs in with password and rejects a wrong password", async () => {
    const enrolled = await enrollOpenAccount(
      db,
      baseInput("jordan@ostt.synth.test"),
    );
    expect(enrolled.ok).toBe(true);

    const service = new AuthService({
      db,
      email: {
        name: "email",
        send: async () => ({
          ok: false,
          error: "unused",
          code: "EMAIL_DISABLED",
        }),
      },
      appUrl: "http://127.0.0.1:3000",
    });

    const ok = await service.signInWithPassword(
      "jordan@ostt.synth.test",
      "a-sufficiently-long-pass",
    );
    expect(ok.ok).toBe(true);

    const bad = await service.signInWithPassword(
      "jordan@ostt.synth.test",
      "totally-wrong-password",
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.code).toBe("AUTH_PASSWORD_INVALID");
    }
  });

  it("rejects duplicate identifier, honeypot, too-fast submit, and kill switch", async () => {
    const first = await enrollOpenAccount(db, baseInput("blake@ostt.synth.test"));
    expect(first.ok).toBe(true);

    const duplicate = await enrollOpenAccount(
      db,
      baseInput("Blake@ostt.synth.test"),
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.code).toBe("ENROLLMENT_DUPLICATE");
    }

    const honeypot = await enrollOpenAccount(db, {
      ...baseInput("casey@ostt.synth.test"),
      honeypot: "http://spam.example",
    });
    expect(honeypot.ok).toBe(false);
    if (!honeypot.ok) {
      expect(honeypot.code).toBe("ENROLLMENT_REJECTED");
    }

    const tooFast = await enrollOpenAccount(db, {
      ...baseInput("drew@ostt.synth.test"),
      formOpenedAt: Date.now(),
    });
    expect(tooFast.ok).toBe(false);
    if (!tooFast.ok) {
      expect(tooFast.code).toBe("ENROLLMENT_TOO_FAST");
    }

    process.env.COMMONHALL_V2_OPEN_ENROLLMENT = "off";
    const killed = await enrollOpenAccount(db, baseInput("eden@ostt.synth.test"));
    expect(killed.ok).toBe(false);
    if (!killed.ok) {
      expect(killed.code).toBe("ENROLLMENT_DISABLED");
    }
  });

  it("rate-limits repeated enrollment attempts for the same identifier", async () => {
    const identifier = "rate@ostt.synth.test";
    let limited = false;
    for (let i = 0; i < 8; i += 1) {
      const result = await enrollOpenAccount(db, {
        ...baseInput(`${i}-${identifier}`),
        identifier,
        clientIp: "198.51.100.20",
      });
      if (!result.ok && result.code === "ENROLLMENT_RATE_LIMITED") {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
