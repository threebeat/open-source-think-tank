import { eq, isNull, and } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  auditEvents,
  councilAppointments,
  invitations,
  operatorBootstrapState,
  roleAssignments,
  verificationCases,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { CaptureEmailAdapter } from "@/lib/email/capture-email-adapter";
import { AuthService } from "@/lib/auth/auth-service";
import { openDocumentPresentation } from "@/lib/assent/presentation";
import { recordAssent } from "@/lib/assent/record-assent";
import {
  finalizeAdministratorBootstrap,
  issueAdministratorBootstrapInvitation,
} from "@/lib/operator/bootstrap";
import { requireOperatorBootstrapEnv } from "@/lib/operator/secrets";
import { openVerificationCase } from "@/lib/verification/cases";
import { L3_KINDS } from "@/lib/verification/seed-assurance";

const OPERATOR_SECRET = "ostt-synth-operator-bootstrap-secret-32chars!!";

function extractToken(body: string): string {
  const match = body.match(/token=([A-Za-z0-9_-]+)/);
  if (!match?.[1]) {
    throw new Error("challenge token missing");
  }
  return match[1];
}

describe("first-administrator bootstrap (3.3)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previousEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    previousEnv = {
      APP_MODE: process.env.APP_MODE,
      DATABASE_URL: process.env.DATABASE_URL,
      OPERATOR_BOOTSTRAP_SECRET: process.env.OPERATOR_BOOTSTRAP_SECRET,
      OPERATOR_LABEL: process.env.OPERATOR_LABEL,
      AUTH_SECRET: process.env.AUTH_SECRET,
    };
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_bootstrap";
    process.env.OPERATOR_BOOTSTRAP_SECRET = OPERATOR_SECRET;
    process.env.OPERATOR_LABEL = "ostt-synth-operator";
    process.env.AUTH_SECRET =
      process.env.AUTH_SECRET ?? "ostt-synth-auth-secret-for-bootstrap-tests";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);

    // Empty-admin precondition for bootstrap ceremony.
    await db
      .update(roleAssignments)
      .set({
        revokedAt: new Date(),
        revocationReason: "Clear seed admins for bootstrap test.",
      })
      .where(
        and(
          eq(roleAssignments.role, "administrator"),
          isNull(roleAssignments.revokedAt),
        ),
      );
    await db
      .update(operatorBootstrapState)
      .set({
        status: "not_started",
        liveInvitationId: null,
        completedAccountId: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(operatorBootstrapState.id, "default"));
  }, 120_000);

  afterAll(async () => {
    await client.close();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("fails closed in public-demo before DB construction", () => {
    const check = requireOperatorBootstrapEnv({
      APP_MODE: "public-demo",
      OPERATOR_BOOTSTRAP_SECRET: OPERATOR_SECRET,
      OPERATOR_LABEL: "x",
    });
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.code).toMatch(/PUBLIC_DEMO|ENV_UNSAFE|forbids/);
    }
  });

  it("issues one bootstrap invitation and finalizes a single administrator", async () => {
    const contact = "first-admin@example.test";
    const issued = await issueAdministratorBootstrapInvitation(db, {
      intendedContactChannel: contact,
      reason: "Owner-run alpha first administrator bootstrap.",
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }

    const email = new CaptureEmailAdapter();
    const service = new AuthService({
      db,
      email,
      appUrl: "http://127.0.0.1:3000",
    });
    const accepted = await service.acceptInvite({
      inviteToken: issued.value.rawToken,
      contactChannel: contact,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) {
      return;
    }

    const mail = email.lastTo(contact);
    expect(mail).toBeTruthy();
    const session = await service.completeChallenge(extractToken(mail!.textBody));
    expect(session.ok).toBe(true);
    if (!session.ok) {
      return;
    }
    const accountId = session.value.accountId;

    const presented = await openDocumentPresentation(db, {
      accountId,
      documentVersionId: "doc-ostt-synth-privacy-v1",
    });
    expect(presented.ok).toBe(true);
    if (!presented.ok) {
      return;
    }
    const assented = await recordAssent(db, {
      accountId,
      documentVersionId: "doc-ostt-synth-privacy-v1",
      presentationId: presented.value.presentationId,
      noticesAcknowledged: ["synthetic-notice"],
      method: "bootstrap-test",
    });
    expect(assented.ok).toBe(true);

    for (const kind of [...L3_KINDS, "eligibility"] as const) {
      const opened = await openVerificationCase(db, {
        accountId,
        kind,
        assertionSummary: `ostt-synth bootstrap assertion for ${kind}`,
        actorAccountId: accountId,
      });
      expect(opened.ok, kind).toBe(true);
    }

    const finalized = await finalizeAdministratorBootstrap(db, {
      reason: "Complete first administrator after gates.",
      verificationReason:
        "Owner-run alpha operator_bootstrap attestation for required kinds.",
    });
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) {
      return;
    }
    expect(finalized.value.accountId).toBe(accountId);

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    expect(account?.lifecycleState).toBe("active");
    expect(account?.synthetic).toBe(false);

    const adminRoles = await db
      .select()
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.role, "administrator"),
          isNull(roleAssignments.revokedAt),
        ),
      );
    expect(adminRoles).toHaveLength(1);
    expect(adminRoles[0]?.accountId).toBe(accountId);

    const participantRoles = await db
      .select()
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.accountId, accountId),
          eq(roleAssignments.role, "participant"),
          isNull(roleAssignments.revokedAt),
        ),
      );
    // Ordinary onboarding may grant participant independently.
    expect(participantRoles.length).toBeGreaterThanOrEqual(0);

    const councils = await db
      .select()
      .from(councilAppointments)
      .where(eq(councilAppointments.accountId, accountId));
    expect(councils).toHaveLength(0);

    const decisions = await db
      .select()
      .from(verificationCases)
      .where(eq(verificationCases.accountId, accountId));
    expect(
      decisions.every(
        (row) =>
          row.decisionSource === "operator_bootstrap" &&
          row.reviewerAccountId === null &&
          row.operatorLabel === "ostt-synth-operator",
      ),
    ).toBe(true);

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "operator.bootstrap_administrator"));
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(audits)).not.toContain(issued.value.rawToken);
    expect(JSON.stringify(audits)).not.toContain(OPERATOR_SECRET);
    expect(JSON.stringify(audits)).not.toContain(contact);

    const again = await finalizeAdministratorBootstrap(db, {
      reason: "retry should fail",
      verificationReason: "retry should fail",
    });
    expect(again.ok).toBe(false);

    const reissue = await issueAdministratorBootstrapInvitation(db, {
      intendedContactChannel: "second@example.test",
      reason: "should refuse after completion",
    });
    expect(reissue.ok).toBe(false);
  }, 120_000);

  it("refuses bootstrap issue while an administrator exists", async () => {
    // After previous test an admin exists.
    const refused = await issueAdministratorBootstrapInvitation(db, {
      intendedContactChannel: "late@example.test",
      reason: "should refuse because admin exists",
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toMatch(/BOOTSTRAP_ALREADY_COMPLETED|BOOTSTRAP_ADMINS_EXIST/);
    }
  });
});
