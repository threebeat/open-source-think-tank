import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { invitations } from "@/db/schema";
import type { DrizzleTx } from "@/db/transaction-context";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { generateOpaqueToken, hashToken, newEntityId } from "@/lib/auth/tokens";
import { authorizeCapability } from "@/lib/authz/authorize-capability";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { assertEnvironmentSafe } from "@/lib/env/app-mode";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const issueInvitationInputSchema = z.object({
  intendedContactChannel: z.string().trim().email().max(320),
  expiresInMs: z.number().int().positive().max(MAX_TTL_MS).optional(),
});

export type IssueInvitationInput = z.infer<typeof issueInvitationInputSchema>;

export type IssuedInvitation = {
  invitationId: string;
  kind: "participant";
  expiresAt: string;
  /** Raw token — returned only from the successful issue call. Never re-read. */
  rawToken: string;
  /** Full acceptance URL containing the raw token — copy now; not recoverable. */
  acceptanceLink: string;
  contactRedacted: string;
};

function normalizeContact(contactChannel: string): string {
  return contactChannel.trim().toLowerCase();
}

function redactContact(contact: string): string {
  const [local, domain] = contact.split("@");
  if (!domain || !local) {
    return "[redacted]";
  }
  return `${local.slice(0, 1)}***@${domain}`;
}

function resolveAppBaseUrl(): string {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

function gatedOrDeny(): AdapterResult<never> | null {
  if (assertEnvironmentSafe() !== "gated") {
    return {
      ok: false,
      error: "Invitation issuance unavailable in public-demo mode",
      code: "PUBLIC_DEMO_NO_INVITES",
    };
  }
  return null;
}

/**
 * Administrator-issued participant invitation. Stores token hash only.
 * Raw token/link returned once from this call.
 */
export async function issueParticipantInvitation(
  db: FoundationDb | DrizzleTx,
  input: {
    actorAccountId: string;
    intendedContactChannel: string;
    expiresInMs?: number;
  },
): Promise<AdapterResult<IssuedInvitation>> {
  const denied = gatedOrDeny();
  if (denied) {
    return denied;
  }

  const parsed = issueInvitationInputSchema.safeParse({
    intendedContactChannel: input.intendedContactChannel,
    expiresInMs: input.expiresInMs,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid invitation input",
      code: "INVITE_INPUT_INVALID",
    };
  }

  const actor = await loadPrincipal(db, input.actorAccountId);
  const decision = await authorizeCapability(db, actor, "invites.issue");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const contact = normalizeContact(parsed.data.intendedContactChannel);
  const ttl = parsed.data.expiresInMs ?? DEFAULT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  const rawToken = generateOpaqueToken(32);
  const tokenHash = hashToken(rawToken);
  const invitationId = newEntityId("invite");
  const synthetic = decision.principal.synthetic;

  try {
    await db.transaction(async (tx) => {
      // Deterministic replacement: revoke prior pending participant invites
      // for the same normalized contact.
      await tx
        .update(invitations)
        .set({
          status: "revoked",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invitations.kind, "participant"),
            eq(invitations.status, "pending"),
            sql`lower(${invitations.intendedContactChannel}) = ${contact}`,
          ),
        );

      await tx.insert(invitations).values({
        id: invitationId,
        tokenHash,
        intendedContactChannel: contact,
        status: "pending",
        kind: "participant",
        synthetic,
        expiresAt,
        issuedByLabel: input.actorAccountId,
        issuedByAccountId: input.actorAccountId,
      });

      await appendAuthAudit(tx, {
        actorRole: "administrator",
        actorAccountId: input.actorAccountId,
        action: "invites.issued",
        subjectType: "invitation",
        subjectId: invitationId,
        summary: "Participant invitation issued.",
        privatePayload: {
          invitationId,
          kind: "participant",
          expiresAt: expiresAt.toISOString(),
          issuerAccountId: input.actorAccountId,
        },
        synthetic,
        forbidSecrets: [rawToken, contact],
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "issue failed";
    const constraint =
      typeof error === "object" &&
      error &&
      "constraint" in error &&
      typeof (error as { constraint?: unknown }).constraint === "string"
        ? (error as { constraint: string }).constraint
        : "";
    // Unique index race: another pending participant invite for this contact won.
    if (
      /invitations_one_pending_participant_contact_uidx/i.test(message) ||
      /invitations_one_pending_participant_contact_uidx/i.test(constraint)
    ) {
      return {
        ok: false,
        error: "Invitation issuance conflict; retry after reload",
        code: "INVITE_ISSUE_CONFLICT",
      };
    }
    if (/token|invite|secret|http/i.test(message)) {
      return {
        ok: false,
        error: "Invitation issuance failed",
        code: "INVITE_ISSUE_FAILED",
      };
    }
    return {
      ok: false,
      error: "Invitation issuance failed",
      code: "INVITE_ISSUE_FAILED",
    };
  }

  const acceptanceLink = `${resolveAppBaseUrl()}/auth/accept?token=${encodeURIComponent(rawToken)}`;

  return {
    ok: true,
    value: {
      invitationId,
      kind: "participant",
      expiresAt: expiresAt.toISOString(),
      rawToken,
      acceptanceLink,
      contactRedacted: redactContact(contact),
    },
  };
}

export type StaffInvitationListItem = {
  invitationId: string;
  kind: string;
  status: string;
  contactRedacted: string;
  expiresAt: string;
  expired: boolean;
  synthetic: boolean;
  issuedByAccountId: string | null;
};

/** List invitations for staff UI — never returns hashes or raw tokens. */
export async function listIssuedInvitations(
  db: FoundationDb,
  actorAccountId: string,
): Promise<AdapterResult<StaffInvitationListItem[]>> {
  const denied = gatedOrDeny();
  if (denied) {
    return denied;
  }

  const actor = await loadPrincipal(db, actorAccountId);
  const decision = await authorizeCapability(db, actor, "invites.issue");
  if (!decision.ok) {
    return { ok: false, error: decision.error, code: decision.code };
  }

  const rows = await db
    .select({
      id: invitations.id,
      kind: invitations.kind,
      status: invitations.status,
      contact: invitations.intendedContactChannel,
      expiresAt: invitations.expiresAt,
      synthetic: invitations.synthetic,
      issuedByAccountId: invitations.issuedByAccountId,
    })
    .from(invitations)
    .orderBy(desc(invitations.createdAt))
    .limit(100);

  const now = Date.now();
  return {
    ok: true,
    value: rows.map((row) => ({
      invitationId: row.id,
      kind: row.kind,
      status: row.status,
      contactRedacted: redactContact(row.contact),
      expiresAt: row.expiresAt.toISOString(),
      expired: row.expiresAt.getTime() <= now && row.status === "pending",
      synthetic: row.synthetic,
      issuedByAccountId: row.issuedByAccountId,
    })),
  };
}
