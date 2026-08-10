import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { accounts, persons, roleAssignments } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { newEntityId } from "@/lib/auth/tokens";
import { activateAccount } from "@/lib/onboarding/activate";
import { getOnboardingProgress } from "@/lib/onboarding/progress";
import {
  listStaffInvitations,
  listStaffOnboardingStatuses,
} from "@/lib/onboarding/staff";
import {
  L2_KINDS,
  L3_KINDS,
  seedApprovedAssertions,
} from "@/lib/verification/seed-assurance";

describe("invite-only onboarding (2.8)", () => {
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
      displayLabel: "ostt-synth Staff Reviewer",
    });
    await db.insert(accounts).values({
      id: "account-ostt-synth-staff-reader",
      personId,
      contactChannel: "staff-reader@ostt.synth.test",
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await db.insert(roleAssignments).values({
      id: newEntityId("role"),
      accountId: "account-ostt-synth-staff-reader",
      role: "reviewer",
      grantedByLabel: "ostt-synth-onboarding-test",
      reason: "Staff onboarding read fixture.",
    });
    await seedApprovedAssertions(
      db,
      "account-ostt-synth-staff-reader",
      L2_KINDS,
    );
  }, 120_000);

  afterAll(async () => {
    await client.close();
  });

  it("blocks activation until assent, L3 verification, and eligibility pass", async () => {
    const before = await getOnboardingProgress(db, "account-ostt-synth-ada");
    expect(before?.lifecycleState).toBe("pending_onboarding");
    expect(before?.canActivate).toBe(false);

    const denied = await activateAccount(db, {
      accountId: "account-ostt-synth-ada",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe("ONBOARD_GATES_INCOMPLETE");
    }

    // Seed already has privacy assent + contact_continuity; add remaining gates.
    await seedApprovedAssertions(db, "account-ostt-synth-ada", [
      "bot_resistance",
      "uniqueness",
      "eligibility",
    ]);

    const ready = await getOnboardingProgress(db, "account-ostt-synth-ada");
    expect(ready?.canActivate).toBe(true);

    const activated = await activateAccount(db, {
      accountId: "account-ostt-synth-ada",
    });
    expect(activated.ok).toBe(true);

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, "account-ostt-synth-ada"));
    expect(account?.lifecycleState).toBe("active");
    expect(account?.activatedAt).toBeTruthy();

    const roles = await db
      .select()
      .from(roleAssignments)
      .where(eq(roleAssignments.accountId, "account-ostt-synth-ada"));
    expect(roles.some((row) => row.role === "participant" && !row.revokedAt)).toBe(
      true,
    );

    const again = await activateAccount(db, {
      accountId: "account-ostt-synth-ada",
    });
    expect(again.ok).toBe(false);
  });

  it("refuses activation when gates are incomplete for ben", async () => {
    const refuse = await activateAccount(db, {
      accountId: "account-ostt-synth-ben",
    });
    expect(refuse.ok).toBe(false);
    if (!refuse.ok) {
      expect(refuse.code).toBe("ONBOARD_GATES_INCOMPLETE");
    }
  });

  it("staff views redact contacts and require assurance", async () => {
    const unauthorized = await listStaffOnboardingStatuses(
      db,
      "account-ostt-synth-ben",
    );
    expect(unauthorized.ok).toBe(false);

    const staff = await listStaffOnboardingStatuses(
      db,
      "account-ostt-synth-staff-reader",
    );
    expect(staff.ok).toBe(true);
    if (staff.ok) {
      for (const row of staff.value) {
        expect(row.contactRedacted).toMatch(/\*\*\*@/);
        expect(row.contactRedacted.includes("@ostt.synth.test")).toBe(true);
      }
    }

    const invites = await listStaffInvitations(
      db,
      "account-ostt-synth-staff-reader",
    );
    expect(invites.ok).toBe(true);
    if (invites.ok) {
      expect(invites.value.some((row) => row.contactRedacted.includes("***"))).toBe(
        true,
      );
    }
  });

  it("documents L3 kinds required for activation floor", () => {
    expect(L3_KINDS).toEqual([
      "bot_resistance",
      "contact_continuity",
      "uniqueness",
    ]);
  });
});
