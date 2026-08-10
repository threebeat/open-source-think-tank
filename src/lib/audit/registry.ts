/**
 * Registry of auditable events and whether they may project publicly (2.9).
 * Private payloads never appear on the public feed.
 */

export type AuditEventSchema = {
  action: string;
  description: string;
  /** If true, a redacted public summary may be projected. */
  publicProjectionAllowed: boolean;
  /** Fields forbidden from public summaries and client logs. */
  prohibitedPublicFields: string[];
  highImpact: boolean;
};

export const AUDIT_EVENT_REGISTRY: Record<string, AuditEventSchema> = {
  "auth.invite_accepted": {
    action: "auth.invite_accepted",
    description: "Invitation accepted",
    publicProjectionAllowed: false,
    prohibitedPublicFields: ["contactChannel", "token", "accountId"],
    highImpact: true,
  },
  "auth.challenge_completed": {
    action: "auth.challenge_completed",
    description: "Auth challenge completed",
    publicProjectionAllowed: false,
    prohibitedPublicFields: ["token", "contactChannel"],
    highImpact: true,
  },
  "authz.platform_role_granted": {
    action: "authz.platform_role_granted",
    description: "Platform role granted",
    publicProjectionAllowed: true,
    prohibitedPublicFields: [
      "accountId",
      "actorAccountId",
      "subjectAccountId",
      "contactChannel",
    ],
    highImpact: true,
  },
  "authz.platform_role_revoked": {
    action: "authz.platform_role_revoked",
    description: "Platform role revoked",
    publicProjectionAllowed: true,
    prohibitedPublicFields: [
      "accountId",
      "actorAccountId",
      "subjectAccountId",
    ],
    highImpact: true,
  },
  "authz.council_seat_granted": {
    action: "authz.council_seat_granted",
    description: "Council seat granted",
    publicProjectionAllowed: true,
    prohibitedPublicFields: ["accountId", "actorAccountId", "subjectAccountId"],
    highImpact: true,
  },
  "authz.council_seat_revoked": {
    action: "authz.council_seat_revoked",
    description: "Council seat revoked",
    publicProjectionAllowed: true,
    prohibitedPublicFields: ["accountId", "actorAccountId", "subjectAccountId"],
    highImpact: true,
  },
  "assent.recorded": {
    action: "assent.recorded",
    description: "Document assent recorded",
    publicProjectionAllowed: false,
    prohibitedPublicFields: ["accountId", "contentHash", "noticesAcknowledged"],
    highImpact: true,
  },
  "assent.withdrawn": {
    action: "assent.withdrawn",
    description: "Assent withdrawn",
    publicProjectionAllowed: false,
    prohibitedPublicFields: ["accountId", "priorAssentId"],
    highImpact: true,
  },
  "assent.document_published": {
    action: "assent.document_published",
    description: "Document version published",
    publicProjectionAllowed: true,
    prohibitedPublicFields: ["accountId", "actorAccountId"],
    highImpact: true,
  },
  "verification.case_approved": {
    action: "verification.case_approved",
    description: "Verification case approved",
    publicProjectionAllowed: false,
    prohibitedPublicFields: [
      "accountId",
      "evidencePointer",
      "subjectAccountId",
    ],
    highImpact: true,
  },
  "verification.case_denied": {
    action: "verification.case_denied",
    description: "Verification case denied",
    publicProjectionAllowed: false,
    prohibitedPublicFields: ["accountId", "subjectAccountId"],
    highImpact: true,
  },
  "onboarding.activated": {
    action: "onboarding.activated",
    description: "Account activated after onboarding gates",
    publicProjectionAllowed: false,
    prohibitedPublicFields: ["accountId", "approvedKinds"],
    highImpact: true,
  },
  "foundation.seeded": {
    action: "foundation.seeded",
    description: "Synthetic foundation seed",
    publicProjectionAllowed: true,
    prohibitedPublicFields: ["accountId"],
    highImpact: false,
  },
};

export const PROHIBITED_PUBLIC_PAYLOAD_KEYS = [
  "accountId",
  "actorAccountId",
  "subjectAccountId",
  "contactChannel",
  "email",
  "token",
  "inviteToken",
  "sessionToken",
  "evidencePointer",
  "verificationArtifacts",
  "privatePayload",
  "opinion",
  "politicalOpinion",
  "password",
] as const;

export function isHighImpactAction(action: string): boolean {
  return AUDIT_EVENT_REGISTRY[action]?.highImpact ?? true;
}
