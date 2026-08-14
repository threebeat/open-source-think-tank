import { eq } from "drizzle-orm";

import {
  accountCredentials,
  accounts,
  assentRecords,
  documentVersions,
  organizationMembershipEvents,
  organizationMemberships,
  persons,
  profiles,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import {
  COMMUNITY_STANDARDS_DOCUMENT_ID,
  COMMUNITY_STANDARDS_NOTICE_ID,
  PRE_ALPHA_ASSIGNMENT_EXPLANATION,
  PRE_ALPHA_ASSIGNMENT_REASON,
  PRE_ALPHA_ASSIGNMENT_RULE_VERSION,
} from "@/lib/auth/community-standards";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { assertActivationTransition } from "@/lib/auth/lifecycle";
import {
  hashPassword,
  isEmailShapedIdentifier,
  normalizeIdentifier,
  PASSWORD_SCHEME,
  validatePassword,
} from "@/lib/auth/passwords";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { hashToken, newEntityId } from "@/lib/auth/tokens";
import { AuthService } from "@/lib/auth/auth-service";
import { activateAccount } from "@/lib/onboarding/activate";
import { SYNTHETIC_ORG_ALPHA_ID } from "@/db/seeds/v2-organizations";
import {
  assertOrganizationMutationAllowed,
  isOpenEnrollmentEnabled,
} from "@/lib/v2/flags";

const ENROLL_RATE_LIMIT = process.env.AUTH_E2E_CAPTURE === "1" ? 64 : 5;
const ENROLL_RATE_WINDOW_MS = 15 * 60 * 1000;
export const ENROLLMENT_MIN_FILL_MS = 1_500;

export type EnrollInput = {
  identifier: string;
  password: string;
  /** Hidden field; any non-empty value is treated as bot abuse. */
  honeypot?: string;
  /** Epoch ms when the form was first shown. */
  formOpenedAt?: number;
  communityStandardsAssent: boolean;
  clientIp?: string | null;
};

export type EnrollSuccess = {
  accountId: string;
  lifecycleState: "active";
  synthetic: boolean;
  sessionId: string;
  rawSessionToken: string;
  assignmentExplanation: string;
  communityStandardsVersion: string;
  organizationId: string;
};

function enrollRateKey(identifier: string, clientIp?: string | null): string {
  const idHash = hashToken(identifier).slice(0, 16);
  const ipHash = hashToken((clientIp ?? "unknown").trim() || "unknown").slice(
    0,
    12,
  );
  return `enroll:${idHash}:${ipHash}`;
}

function uniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 6 && current; i += 1) {
    const code =
      typeof current === "object" && current && "code" in current
        ? String((current as { code?: unknown }).code)
        : "";
    const message = current instanceof Error ? current.message : String(current);
    if (
      code === "23505" ||
      /unique|duplicate key|already exists/i.test(message)
    ) {
      return true;
    }
    current =
      typeof current === "object" && current && "cause" in current
        ? (current as { cause: unknown }).cause
        : undefined;
  }
  return false;
}

export async function enrollOpenAccount(
  db: FoundationDb,
  input: EnrollInput,
  now = new Date(),
): Promise<AdapterResult<EnrollSuccess>> {
  assertOrganizationMutationAllowed();
  if (!isOpenEnrollmentEnabled()) {
    return {
      ok: false,
      error: "Open enrollment is not available.",
      code: "ENROLLMENT_DISABLED",
    };
  }

  if (input.honeypot?.trim()) {
    return {
      ok: false,
      error: "Enrollment could not be completed.",
      code: "ENROLLMENT_REJECTED",
    };
  }

  const opened = Number(input.formOpenedAt);
  if (!Number.isFinite(opened) || now.getTime() - opened < ENROLLMENT_MIN_FILL_MS) {
    return {
      ok: false,
      error: "Please take a moment to review the form, then try again.",
      code: "ENROLLMENT_TOO_FAST",
    };
  }

  const identifier = normalizeIdentifier(input.identifier);
  if (!isEmailShapedIdentifier(identifier)) {
    return {
      ok: false,
      error: "Use an email-shaped identifier (stored locally; no message is sent).",
      code: "ENROLLMENT_IDENTIFIER_INVALID",
    };
  }

  const passwordCheck = validatePassword(input.password, identifier);
  if (!passwordCheck.ok) {
    return passwordCheck;
  }

  if (!input.communityStandardsAssent) {
    return {
      ok: false,
      error: "You must assent to the current community standards to create an account.",
      code: "ENROLLMENT_ASSENT_REQUIRED",
    };
  }

  const limited = consumeRateLimit(
    enrollRateKey(identifier, input.clientIp),
    ENROLL_RATE_LIMIT,
    ENROLL_RATE_WINDOW_MS,
    now.getTime(),
  );
  if (!limited.ok) {
    return {
      ok: false,
      error: "Too many enrollment attempts. Try again later.",
      code: "ENROLLMENT_RATE_LIMITED",
    };
  }

  const personId = newEntityId("person");
  const accountId = newEntityId("account");
  const membershipId = newEntityId("orgmem");
  const eventId = newEntityId("orgmev");
  const assentId = newEntityId("assent");
  const passwordHash = await hashPassword(input.password);

  try {
    const enrolled = await db.transaction(async (tx) => {
      const [standards] = await tx
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.id, COMMUNITY_STANDARDS_DOCUMENT_ID))
        .limit(1);
      if (!standards || standards.state !== "published") {
        throw new Error("ENROLLMENT_STANDARDS_UNAVAILABLE");
      }

      await tx.insert(persons).values({
        id: personId,
        synthetic: true,
        displayLabel: `commonhall member ${accountId.slice(-6)}`,
        notes:
          "Created via gated open enrollment (Phase 2). Identifier is stored locally; no outbound email.",
      });

      await tx.insert(accounts).values({
        id: accountId,
        personId,
        contactChannel: identifier,
        lifecycleState: "pending_onboarding",
        enrollmentKind: "open",
        synthetic: true,
        contactVerifiedAt: now,
      });

      await tx.insert(profiles).values({
        accountId,
        preferredDisplayName: `Participant ${accountId.slice(-6)}`,
      });

      await tx.insert(accountCredentials).values({
        accountId,
        passwordHash,
        passwordScheme: PASSWORD_SCHEME,
      });

      await tx.insert(assentRecords).values({
        id: assentId,
        accountId,
        documentVersionId: standards.id,
        contentHash: standards.contentHash,
        method: "open_enrollment_form",
        noticesAcknowledged: [COMMUNITY_STANDARDS_NOTICE_ID],
        synthetic: true,
      });

      await tx.insert(organizationMemberships).values({
        id: membershipId,
        organizationId: SYNTHETIC_ORG_ALPHA_ID,
        accountId,
        status: "active",
        isPrimary: true,
        assignedAt: now,
        synthetic: true,
      });

      await tx.insert(organizationMembershipEvents).values({
        id: eventId,
        organizationId: SYNTHETIC_ORG_ALPHA_ID,
        membershipId,
        accountId,
        eventKind: "assignment",
        actorPrincipalKind: "system",
        actorAccountId: null,
        reason: PRE_ALPHA_ASSIGNMENT_REASON,
        ruleVersion: PRE_ALPHA_ASSIGNMENT_RULE_VERSION,
        at: now,
        synthetic: true,
      });

      await appendAuthAudit(tx, {
        actorRole: "account_holder",
        actorAccountId: accountId,
        action: "auth.enrolled",
        subjectType: "account",
        subjectId: accountId,
        summary: "Open enrollment created a community account and assignment.",
        privatePayload: {
          enrollmentKind: "open",
          communityStandardsVersion: standards.versionLabel,
          membershipId,
        },
        forbidSecrets: [input.password, passwordHash],
        synthetic: true,
        organizationId: SYNTHETIC_ORG_ALPHA_ID,
        actorPrincipalKind: "community_member",
        projectionClass: "protected",
      });

      return { communityStandardsVersion: standards.versionLabel };
    });

    const activated = await activateAccount(db, { accountId });
    if (!activated.ok) {
      return {
        ok: false,
        error: activated.error,
        code: activated.code,
      };
    }

    const session = await new AuthService({
      db,
      email: {
        name: "email",
        send: async () => ({
          ok: false,
          error: "Enrollment does not send email.",
          code: "EMAIL_DISABLED",
        }),
      },
      appUrl: "http://127.0.0.1:3000",
      now: () => now,
    }).establishSession(accountId);

    if (!session.ok) {
      return session;
    }

    return {
      ok: true,
      value: {
        accountId,
        lifecycleState: "active",
        synthetic: true,
        sessionId: session.value.sessionId,
        rawSessionToken: session.value.rawSessionToken,
        assignmentExplanation: PRE_ALPHA_ASSIGNMENT_EXPLANATION,
        communityStandardsVersion: enrolled.communityStandardsVersion,
        organizationId: SYNTHETIC_ORG_ALPHA_ID,
      },
    };
  } catch (error) {
    if (uniqueViolation(error)) {
      return {
        ok: false,
        error: "An account with that identifier already exists.",
        code: "ENROLLMENT_DUPLICATE",
      };
    }
    if (error instanceof Error && error.message === "ENROLLMENT_STANDARDS_UNAVAILABLE") {
      return {
        ok: false,
        error: "Community standards are not available for assent.",
        code: "ENROLLMENT_STANDARDS_UNAVAILABLE",
      };
    }
    throw error;
  }
}

/** Used by tests to prove activateAccount remains the only path to active. */
export { assertActivationTransition };
