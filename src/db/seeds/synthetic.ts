import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import {
  accounts,
  assentRecords,
  auditEvents,
  councilAppointments,
  documentVersions,
  invitations,
  persons,
  profiles,
  roleAssignments,
  schemaMeta,
  verificationAssertions,
  verificationCases,
} from "../schema";
import type { FoundationDb } from "../types";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Synthetic-only seed data. Labels use the ostt-synth- prefix so they cannot be
 * mistaken for real people. Never load production participant data here.
 */
export async function seedSyntheticFoundation(db: FoundationDb) {
  await db.insert(schemaMeta).values({
    key: "migration_label",
    value: "2.4-auth-foundation",
  });

  await db.insert(persons).values([
    {
      id: "person-ostt-synth-ada",
      synthetic: true,
      displayLabel: "ostt-synth Ada (seed)",
      notes: "Synthetic seed person — not a real individual.",
    },
    {
      id: "person-ostt-synth-ben",
      synthetic: true,
      displayLabel: "ostt-synth Ben (seed)",
      notes: "Synthetic seed person — not a real individual.",
    },
  ]);

  await db.insert(accounts).values([
    {
      id: "account-ostt-synth-ada",
      personId: "person-ostt-synth-ada",
      contactChannel: "ada@ostt.synth.test",
      lifecycleState: "pending_onboarding",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    {
      id: "account-ostt-synth-ben",
      personId: "person-ostt-synth-ben",
      contactChannel: "ben@ostt.synth.test",
      lifecycleState: "pending_onboarding",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  ]);

  await db.insert(profiles).values([
    {
      accountId: "account-ostt-synth-ada",
      preferredDisplayName: "ostt-synth Ada",
    },
    {
      accountId: "account-ostt-synth-ben",
      preferredDisplayName: "ostt-synth Ben",
    },
  ]);

  await db.insert(invitations).values([
    {
      id: "invite-ostt-synth-ada",
      tokenHash: hashToken("ostt-synth-invite-token-ada"),
      intendedContactChannel: "ada@ostt.synth.test",
      status: "accepted",
      synthetic: true,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      acceptedAt: new Date("2026-08-01T00:00:00.000Z"),
      acceptedAccountId: "account-ostt-synth-ada",
      issuedByLabel: "ostt-synth-seeder",
    },
    {
      id: "invite-ostt-synth-cory-pending",
      tokenHash: hashToken("ostt-synth-invite-token-cory"),
      intendedContactChannel: "cory@ostt.synth.test",
      status: "pending",
      synthetic: true,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      issuedByLabel: "ostt-synth-seeder",
    },
  ]);

  await db.insert(roleAssignments).values({
    id: "role-ostt-synth-ada-participant",
    accountId: "account-ostt-synth-ada",
    role: "participant",
    grantedByLabel: "ostt-synth-seeder",
    reason: "Synthetic seed assignment for foundation tests.",
  });

  await db.insert(councilAppointments).values([
    {
      id: "council-ostt-synth-ada-deliberation",
      accountId: "account-ostt-synth-ada",
      councilRole: "deliberation_council",
      selectionPath: "Synthetic deliberation selection path (seed).",
      termStartsOn: new Date("2026-08-01T00:00:00.000Z"),
    },
    {
      id: "council-ostt-synth-ada-policy",
      accountId: "account-ostt-synth-ada",
      councilRole: "policy_council",
      selectionPath: "Synthetic policy selection path (seed) — independent row.",
      termStartsOn: new Date("2026-08-01T00:00:00.000Z"),
    },
  ]);

  const privacyBody =
    "Synthetic privacy notice for foundation tests. Provisional engineering text — counsel disposition still blocking for production legal claims.";
  const contentHash = createHash("sha256").update(privacyBody).digest("hex");
  const reviewedAt = new Date("2026-08-01T00:00:00.000Z");
  const publishedAt = new Date("2026-08-01T01:00:00.000Z");

  // Insert as draft, then transition — DB state machine forbids non-draft inserts.
  await db.insert(documentVersions).values({
    id: "doc-ostt-synth-privacy-v1",
    kind: "privacy_notice",
    versionLabel: "v1-synth",
    contentHash,
    title: "Synthetic privacy notice",
    body: privacyBody,
    state: "draft",
    requiredNotices: ["synthetic-notice"],
  });
  await db
    .update(documentVersions)
    .set({
      state: "counsel_reviewed",
      counselReviewedAt: reviewedAt,
      counselReviewedByAccountId: "account-ostt-synth-ben",
      updatedAt: reviewedAt,
    })
    .where(eq(documentVersions.id, "doc-ostt-synth-privacy-v1"));
  await db
    .update(documentVersions)
    .set({
      state: "published",
      publishedAt,
      publishedByAccountId: "account-ostt-synth-ben",
      updatedAt: publishedAt,
    })
    .where(eq(documentVersions.id, "doc-ostt-synth-privacy-v1"));

  await db.insert(assentRecords).values({
    id: "assent-ostt-synth-ada-privacy-v1",
    accountId: "account-ostt-synth-ada",
    documentVersionId: "doc-ostt-synth-privacy-v1",
    contentHash,
    method: "synthetic-seed",
    noticesAcknowledged: ["synthetic-notice"],
    synthetic: true,
  });

  await db.insert(verificationCases).values({
    id: "vcase-ostt-synth-ada-contact",
    accountId: "account-ostt-synth-ada",
    kind: "contact_continuity",
    status: "approved",
    reviewerAccountId: "account-ostt-synth-ben",
    decisionReason: "Synthetic approval for seed data.",
    assignedAt: new Date("2026-08-01T00:30:00.000Z"),
    decidedAt: new Date("2026-08-01T01:00:00.000Z"),
    synthetic: true,
  });

  await db.insert(verificationAssertions).values({
    id: "vassert-ostt-synth-ada-contact",
    caseId: "vcase-ostt-synth-ada-contact",
    kind: "contact_continuity",
    assertionSummary: "Synthetic contact continuity assertion (no raw artifact).",
  });

  await db.insert(auditEvents).values({
    id: "audit-ostt-synth-seed",
    actorRole: "ostt-synth-seeder",
    action: "foundation.seeded",
    subjectType: "schema",
    subjectId: "2.4-auth-foundation",
    summary: "Synthetic foundation seed applied.",
    synthetic: true,
  });
}

/** Raw invite token for synthetic pending invitation — tests/E2E only. */
export const SYNTHETIC_PENDING_INVITE_TOKEN = "ostt-synth-invite-token-cory";
export const SYNTHETIC_PENDING_INVITE_CONTACT = "cory@ostt.synth.test";

