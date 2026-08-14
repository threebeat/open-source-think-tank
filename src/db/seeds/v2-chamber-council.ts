import {
  accounts,
  appointmentConflictsAndRecusals,
  organizationAppointments,
  organizationMemberships,
  persons,
  profiles,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import {
  insertGovernanceEvent,
  insertGovernanceRecord,
  updateGovernanceRecordState,
} from "@/lib/governance/repository";
import { GOVERNANCE_CONTRACT } from "@/lib/governance/contract";
import {
  SYNTHETIC_ORG_ALPHA_CONFIG_ID,
  SYNTHETIC_ORG_ALPHA_ID,
} from "@/db/seeds/v2-organizations";
import { SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID } from "@/db/seeds/v2-agenda";
import { assertOrganizationMutationAllowed } from "@/lib/v2/flags";
import {
  playQueueForChamber,
  playSyntheticChamberToRecommendations,
  SYNTHETIC_BODY_TIMEZONE,
} from "@/lib/bodies/playback";
import {
  insertChamberSession,
  insertChamberRollCalls,
  insertChamberVerdict,
  insertCouncilRecommendation,
  insertCouncilRollCalls,
  insertCouncilSession,
} from "@/lib/bodies/repository";
import { memberPublicIdForAppointment } from "@/lib/bodies/types";

export const SYNTHETIC_ORG_ADMIN_ACCOUNT_ID = "account-ostt-synth-org-admin";
export const SYNTHETIC_CHAMBER_CLERK_ACCOUNT_ID =
  "account-ostt-synth-chamber-clerk";
export const SYNTHETIC_CHAMBER_MEMBER_A_ACCOUNT_ID =
  "account-ostt-synth-chamber-a";
export const SYNTHETIC_CHAMBER_MEMBER_B_ACCOUNT_ID =
  "account-ostt-synth-chamber-b";
export const SYNTHETIC_CHAMBER_MEMBER_C_ACCOUNT_ID =
  "account-ostt-synth-chamber-c";
export const SYNTHETIC_COUNCIL_CLERK_ACCOUNT_ID =
  "account-ostt-synth-council-clerk";
export const SYNTHETIC_COUNCIL_MEMBER_A_ACCOUNT_ID =
  "account-ostt-synth-council-a";
export const SYNTHETIC_COUNCIL_MEMBER_B_ACCOUNT_ID =
  "account-ostt-synth-council-b";
export const SYNTHETIC_COUNCIL_MEMBER_C_ACCOUNT_ID =
  "account-ostt-synth-council-c";

export const SYNTHETIC_CHAMBER_CLERK_APPOINTMENT_ID =
  "orgappt_ostt_synth_chamber_clerk";
export const SYNTHETIC_CHAMBER_MEMBER_A_APPOINTMENT_ID =
  "orgappt_ostt_synth_chamber_a";
export const SYNTHETIC_CHAMBER_MEMBER_B_APPOINTMENT_ID =
  "orgappt_ostt_synth_chamber_b";
export const SYNTHETIC_CHAMBER_MEMBER_C_APPOINTMENT_ID =
  "orgappt_ostt_synth_chamber_c";
export const SYNTHETIC_COUNCIL_CLERK_APPOINTMENT_ID =
  "orgappt_ostt_synth_council_clerk";
export const SYNTHETIC_COUNCIL_MEMBER_A_APPOINTMENT_ID =
  "orgappt_ostt_synth_council_a";
export const SYNTHETIC_COUNCIL_MEMBER_B_APPOINTMENT_ID =
  "orgappt_ostt_synth_council_b";
export const SYNTHETIC_COUNCIL_MEMBER_C_APPOINTMENT_ID =
  "orgappt_ostt_synth_council_c";

export const SYNTHETIC_JOURNEY_SLUG = "ostt-synth-sidewalk-repair";
export const SYNTHETIC_JOURNEY_PUBLIC_ID = "gov-ostt-synth-alpha-sidewalks";
export const SYNTHETIC_JOURNEY_RECORD_ID = "govrec_ostt_synth_alpha_sidewalks";

const TERM_STARTS = new Date("2026-08-01T00:00:00.000Z");
const CREATED_AT = new Date("2026-08-12T15:00:00.000Z");
const QUALIFIED_AT = new Date("2026-08-12T16:00:00.000Z");
const CLOSED_AT = new Date("2026-08-13T12:00:00.000Z");
const CHAMBER_OPENS = new Date("2026-08-14T17:00:00.000Z");
const CHAMBER_CLOSES = new Date("2026-08-14T19:00:00.000Z");
const COUNCIL_OPENS = new Date("2026-08-16T17:00:00.000Z");
const COUNCIL_CLOSES = new Date("2026-08-16T19:00:00.000Z");

function kernelAllowed(): boolean {
  try {
    assertOrganizationMutationAllowed();
    return true;
  } catch {
    return false;
  }
}

async function insertBodyPerson(
  db: FoundationDb,
  input: {
    personId: string;
    accountId: string;
    label: string;
    contact: string;
  },
): Promise<void> {
  await db.insert(persons).values({
    id: input.personId,
    synthetic: true,
    displayLabel: `${input.label} (seed)`,
    notes: "Synthetic Chamber/Council fixture — not a real individual.",
  });
  await db.insert(accounts).values({
    id: input.accountId,
    personId: input.personId,
    contactChannel: input.contact,
    lifecycleState: "active",
    synthetic: true,
    contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    activatedAt: new Date("2026-08-02T00:00:00.000Z"),
  });
  await db.insert(profiles).values({
    accountId: input.accountId,
    preferredDisplayName: input.label,
  });
  await db.insert(organizationMemberships).values({
    id: `orgmem_${input.accountId}`,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    accountId: input.accountId,
    status: "active",
    isPrimary: true,
    assignedAt: new Date("2026-08-02T00:00:00.000Z"),
    synthetic: true,
  });
}

/**
 * Synthetic Chamber/Council appointments and a complete fixture journey.
 * Not copied from legacy deliberation_council / policy_council seats.
 * Dual-control CHECK remains: issued_by_account_id <> subject account_id.
 */
export async function seedV2ChamberCouncil(db: FoundationDb): Promise<void> {
  await insertBodyPerson(db, {
    personId: "person-ostt-synth-org-admin",
    accountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
    label: "ostt-synth Org Admin",
    contact: "org-admin@ostt.synth.test",
  });
  await insertBodyPerson(db, {
    personId: "person-ostt-synth-chamber-clerk",
    accountId: SYNTHETIC_CHAMBER_CLERK_ACCOUNT_ID,
    label: "ostt-synth Chamber Clerk",
    contact: "chamber-clerk@ostt.synth.test",
  });
  await insertBodyPerson(db, {
    personId: "person-ostt-synth-chamber-a",
    accountId: SYNTHETIC_CHAMBER_MEMBER_A_ACCOUNT_ID,
    label: "ostt-synth Chamber Member A",
    contact: "chamber-a@ostt.synth.test",
  });
  await insertBodyPerson(db, {
    personId: "person-ostt-synth-chamber-b",
    accountId: SYNTHETIC_CHAMBER_MEMBER_B_ACCOUNT_ID,
    label: "ostt-synth Chamber Member B",
    contact: "chamber-b@ostt.synth.test",
  });
  await insertBodyPerson(db, {
    personId: "person-ostt-synth-chamber-c",
    accountId: SYNTHETIC_CHAMBER_MEMBER_C_ACCOUNT_ID,
    label: "ostt-synth Chamber Member C",
    contact: "chamber-c@ostt.synth.test",
  });
  await insertBodyPerson(db, {
    personId: "person-ostt-synth-council-clerk",
    accountId: SYNTHETIC_COUNCIL_CLERK_ACCOUNT_ID,
    label: "ostt-synth Council Clerk",
    contact: "council-clerk@ostt.synth.test",
  });
  await insertBodyPerson(db, {
    personId: "person-ostt-synth-council-a",
    accountId: SYNTHETIC_COUNCIL_MEMBER_A_ACCOUNT_ID,
    label: "ostt-synth Council Member A",
    contact: "council-a@ostt.synth.test",
  });
  await insertBodyPerson(db, {
    personId: "person-ostt-synth-council-b",
    accountId: SYNTHETIC_COUNCIL_MEMBER_B_ACCOUNT_ID,
    label: "ostt-synth Council Member B",
    contact: "council-b@ostt.synth.test",
  });
  await insertBodyPerson(db, {
    personId: "person-ostt-synth-council-c",
    accountId: SYNTHETIC_COUNCIL_MEMBER_C_ACCOUNT_ID,
    label: "ostt-synth Council Member C",
    contact: "council-c@ostt.synth.test",
  });

  await db.insert(organizationAppointments).values([
    {
      id: "orgappt_ostt_synth_org_admin",
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      accountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
      appointmentKind: "organization_admin",
      termStartsAt: TERM_STARTS,
      issuedByAccountId: "account-ostt-synth-staff-admin",
      issuedByPrincipalKind: "service_operator",
      synthetic: true,
    },
    {
      id: SYNTHETIC_CHAMBER_CLERK_APPOINTMENT_ID,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      accountId: SYNTHETIC_CHAMBER_CLERK_ACCOUNT_ID,
      appointmentKind: "chamber_clerk",
      termStartsAt: TERM_STARTS,
      issuedByAccountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
      issuedByPrincipalKind: "organization_officer",
      synthetic: true,
    },
    {
      id: SYNTHETIC_CHAMBER_MEMBER_A_APPOINTMENT_ID,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      accountId: SYNTHETIC_CHAMBER_MEMBER_A_ACCOUNT_ID,
      appointmentKind: "chamber_member",
      termStartsAt: TERM_STARTS,
      issuedByAccountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
      issuedByPrincipalKind: "organization_officer",
      synthetic: true,
    },
    {
      id: SYNTHETIC_CHAMBER_MEMBER_B_APPOINTMENT_ID,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      accountId: SYNTHETIC_CHAMBER_MEMBER_B_ACCOUNT_ID,
      appointmentKind: "chamber_member",
      termStartsAt: TERM_STARTS,
      issuedByAccountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
      issuedByPrincipalKind: "organization_officer",
      synthetic: true,
    },
    {
      id: SYNTHETIC_CHAMBER_MEMBER_C_APPOINTMENT_ID,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      accountId: SYNTHETIC_CHAMBER_MEMBER_C_ACCOUNT_ID,
      appointmentKind: "chamber_member",
      termStartsAt: TERM_STARTS,
      issuedByAccountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
      issuedByPrincipalKind: "organization_officer",
      synthetic: true,
    },
    {
      id: SYNTHETIC_COUNCIL_CLERK_APPOINTMENT_ID,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      accountId: SYNTHETIC_COUNCIL_CLERK_ACCOUNT_ID,
      appointmentKind: "council_clerk",
      termStartsAt: TERM_STARTS,
      issuedByAccountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
      issuedByPrincipalKind: "organization_officer",
      synthetic: true,
    },
    {
      id: SYNTHETIC_COUNCIL_MEMBER_A_APPOINTMENT_ID,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      accountId: SYNTHETIC_COUNCIL_MEMBER_A_ACCOUNT_ID,
      appointmentKind: "council_member",
      termStartsAt: TERM_STARTS,
      issuedByAccountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
      issuedByPrincipalKind: "organization_officer",
      synthetic: true,
    },
    {
      id: SYNTHETIC_COUNCIL_MEMBER_B_APPOINTMENT_ID,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      accountId: SYNTHETIC_COUNCIL_MEMBER_B_ACCOUNT_ID,
      appointmentKind: "council_member",
      termStartsAt: TERM_STARTS,
      issuedByAccountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
      issuedByPrincipalKind: "organization_officer",
      synthetic: true,
    },
    {
      id: SYNTHETIC_COUNCIL_MEMBER_C_APPOINTMENT_ID,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      accountId: SYNTHETIC_COUNCIL_MEMBER_C_ACCOUNT_ID,
      appointmentKind: "council_member",
      termStartsAt: TERM_STARTS,
      issuedByAccountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
      issuedByPrincipalKind: "organization_officer",
      synthetic: true,
    },
  ]);

  await insertGovernanceRecord(db, {
    id: SYNTHETIC_JOURNEY_RECORD_ID,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    publicId: SYNTHETIC_JOURNEY_PUBLIC_ID,
    state: "qualified_consultation",
    configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
    authorAccountId: "account-ostt-synth-ada",
    slug: SYNTHETIC_JOURNEY_SLUG,
    title: "Synthetic qualified topic: sidewalk repair",
    question: "Should the hall publish a sidewalk repair schedule?",
    overview:
      "Synthetic seed walked from closed consultation through Chamber and Council to published recommendations. Labeled synthetic. Not a production Chamber or Council size (V2-09/10).",
    syntheticEvidence: {
      labeledSynthetic: true,
      items: [
        {
          title: "Synthetic sidewalk condition note",
          summary: "Synthetic seed evidence copy. Not derived from consultation votes.",
          qualityStatus: "limited",
          limitations: "Synthetic fixture. Evidence quality is independent of consultation popularity.",
        },
      ],
    },
    syntheticStatements: [
      {
        publicId: "stmt-ostt-synth-sidewalk-schedule",
        text: "Synthetic statement: publish a sidewalk repair schedule.",
      },
    ],
    currentProviderEntityId: "pvent_ostt_synth_alpha_sidewalks",
    synthetic: true,
  });
  await db.insert(appointmentConflictsAndRecusals).values({
    id: "apconf_ostt_synth_chamber_c_sidewalks",
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    appointmentId: SYNTHETIC_CHAMBER_MEMBER_C_APPOINTMENT_ID,
    accountId: SYNTHETIC_CHAMBER_MEMBER_C_ACCOUNT_ID,
    kind: "recusal",
    topicGovernanceRecordId: SYNTHETIC_JOURNEY_RECORD_ID,
    reason:
      "Synthetic recusal: ostt-synth Chamber Member C is recused from the sidewalk fixture. Position is recorded as recused, not inferred.",
    at: CHAMBER_OPENS,
    synthetic: true,
  });
  await insertGovernanceEvent(db, {
    id: `${SYNTHETIC_JOURNEY_RECORD_ID}_evt_qualify`,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    recordId: SYNTHETIC_JOURNEY_RECORD_ID,
    fromState: "formal_review_pending",
    toState: "qualified_consultation",
    action: "qualify",
    actorPrincipalKind: "organization_officer",
    actorAccountId: "account-ostt-synth-staff-moderator",
    reason: "Synthetic seed: published criteria checked. Not an endorsement.",
    criteriaTrace: {
      labeledSynthetic: true,
      completeness: "met",
      safety: "met",
      viewpointNeutral: true,
    },
    configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
    ruleVersion: GOVERNANCE_CONTRACT.schemaVersion,
    at: QUALIFIED_AT,
    synthetic: true,
  });
  await insertGovernanceEvent(db, {
    id: `${SYNTHETIC_JOURNEY_RECORD_ID}_evt_close`,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    recordId: SYNTHETIC_JOURNEY_RECORD_ID,
    fromState: "qualified_consultation",
    toState: "community_accepted",
    action: "close_as_accepted",
    actorPrincipalKind: "system",
    actorAccountId: null,
    reason: "Fixture playback only. Not a production consultation threshold.",
    metricsSnapshot: {
      labeledSynthetic: true,
      openDecision: "V2-07",
      ruleVersion: "synthetic-fixture",
      outcome: "community_accepted",
      participationCount: 16,
      note: "Fixture playback only. Not a production consultation threshold.",
    },
    configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
    ruleVersion: GOVERNANCE_CONTRACT.schemaVersion,
    at: CLOSED_AT,
    synthetic: true,
  });
  await updateGovernanceRecordState(db, {
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    recordId: SYNTHETIC_JOURNEY_RECORD_ID,
    state: "community_accepted",
  });

  if (kernelAllowed()) {
    const queuedLibrary = await playQueueForChamber(db, {
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      recordId: SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID,
    });
    if (!queuedLibrary.ok) {
      throw new Error(`CHAMBER_SEED_QUEUE_LIBRARY:${queuedLibrary.code}`);
    }
    await insertChamberSession(db, {
      id: "chsess_ostt_synth_alpha_library",
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      publicId: "chsess-ostt-synth-library",
      recordId: SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID,
      status: "scheduled",
      timezone: SYNTHETIC_BODY_TIMEZONE,
      scheduledOpensAt: CHAMBER_OPENS,
      scheduledClosesAt: CHAMBER_CLOSES,
      synthetic: true,
    });

    const journey = await playSyntheticChamberToRecommendations(db, {
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      recordId: SYNTHETIC_JOURNEY_RECORD_ID,
      chamberClerkAccountId: SYNTHETIC_CHAMBER_CLERK_ACCOUNT_ID,
      chamberMemberAccountId: SYNTHETIC_CHAMBER_MEMBER_A_ACCOUNT_ID,
      councilClerkAccountId: SYNTHETIC_COUNCIL_CLERK_ACCOUNT_ID,
      councilMemberAccountId: SYNTHETIC_COUNCIL_MEMBER_A_ACCOUNT_ID,
      chamberOpensAt: CHAMBER_OPENS,
      chamberClosesAt: CHAMBER_CLOSES,
      councilOpensAt: COUNCIL_OPENS,
      councilClosesAt: COUNCIL_CLOSES,
      chamberPositions: ["yes", "no", "recused"],
      councilPositions: ["yes", "abstain", "absent"],
      chamberRationale:
        "Synthetic Chamber accepted verdict. Fixture only. Not a production quorum result (V2-09).",
      councilRationale:
        "Synthetic Council recommendations. Fixture only. Not enacted law and not a production cadence (V2-10).",
      minorityReasoning:
        "Synthetic minority note: Chamber Member B voted no; Council Member B abstained. Positions are explicit.",
    });
    if (!journey.ok) {
      throw new Error(`CHAMBER_SEED_JOURNEY:${journey.code}`);
    }
    return;
  }

  await insertGovernanceEvent(db, {
    id: `${SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID}_evt_queue`,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    recordId: SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID,
    fromState: "community_accepted",
    toState: "chamber_queued",
    action: "queue_for_chamber",
    actorPrincipalKind: "system",
    actorAccountId: null,
    reason: "Synthetic seed queue. Trusted system actor is seed-only.",
    configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
    ruleVersion: GOVERNANCE_CONTRACT.schemaVersion,
    at: CHAMBER_OPENS,
    synthetic: true,
  });
  await updateGovernanceRecordState(db, {
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    recordId: SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID,
    state: "chamber_queued",
  });
  await insertChamberSession(db, {
    id: "chsess_ostt_synth_alpha_library",
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    publicId: "chsess-ostt-synth-library",
    recordId: SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID,
    status: "scheduled",
    timezone: SYNTHETIC_BODY_TIMEZONE,
    scheduledOpensAt: CHAMBER_OPENS,
    scheduledClosesAt: CHAMBER_CLOSES,
    synthetic: true,
  });
  await seedJourneyWithoutKernel(db);
  void CREATED_AT;
}

async function seedJourneyWithoutKernel(db: FoundationDb): Promise<void> {
  const steps: Array<{
    from: "community_accepted" | "chamber_queued" | "chamber_deliberating" | "chamber_accepted" | "council_scheduled" | "council_deliberating";
    to: "chamber_queued" | "chamber_deliberating" | "chamber_accepted" | "council_scheduled" | "council_deliberating" | "recommendations_published";
    action:
      | "queue_for_chamber"
      | "start_chamber_deliberation"
      | "record_chamber_acceptance"
      | "accept_to_council_agenda"
      | "start_council_deliberation"
      | "publish_recommendations";
    actor: "system" | "organization_officer";
    accountId: string | null;
    at: Date;
  }> = [
    {
      from: "community_accepted",
      to: "chamber_queued",
      action: "queue_for_chamber",
      actor: "system",
      accountId: null,
      at: CHAMBER_OPENS,
    },
    {
      from: "chamber_queued",
      to: "chamber_deliberating",
      action: "start_chamber_deliberation",
      actor: "organization_officer",
      accountId: SYNTHETIC_CHAMBER_CLERK_ACCOUNT_ID,
      at: CHAMBER_OPENS,
    },
    {
      from: "chamber_deliberating",
      to: "chamber_accepted",
      action: "record_chamber_acceptance",
      actor: "organization_officer",
      accountId: SYNTHETIC_CHAMBER_MEMBER_A_ACCOUNT_ID,
      at: CHAMBER_CLOSES,
    },
    {
      from: "chamber_accepted",
      to: "council_scheduled",
      action: "accept_to_council_agenda",
      actor: "organization_officer",
      accountId: SYNTHETIC_COUNCIL_MEMBER_A_ACCOUNT_ID,
      at: COUNCIL_OPENS,
    },
    {
      from: "council_scheduled",
      to: "council_deliberating",
      action: "start_council_deliberation",
      actor: "organization_officer",
      accountId: SYNTHETIC_COUNCIL_CLERK_ACCOUNT_ID,
      at: COUNCIL_OPENS,
    },
    {
      from: "council_deliberating",
      to: "recommendations_published",
      action: "publish_recommendations",
      actor: "organization_officer",
      accountId: SYNTHETIC_COUNCIL_MEMBER_A_ACCOUNT_ID,
      at: COUNCIL_CLOSES,
    },
  ];
  for (const step of steps) {
    await insertGovernanceEvent(db, {
      id: `${SYNTHETIC_JOURNEY_RECORD_ID}_evt_${step.action}`,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      recordId: SYNTHETIC_JOURNEY_RECORD_ID,
      fromState: step.from,
      toState: step.to,
      action: step.action,
      actorPrincipalKind: step.actor,
      actorAccountId: step.accountId,
      reason: "Synthetic seed journey. Not a production appointment policy.",
      configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
      ruleVersion: GOVERNANCE_CONTRACT.schemaVersion,
      at: step.at,
      synthetic: true,
    });
  }
  await updateGovernanceRecordState(db, {
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    recordId: SYNTHETIC_JOURNEY_RECORD_ID,
    state: "recommendations_published",
  });

  const chamberSessionId = `chsess_${SYNTHETIC_JOURNEY_RECORD_ID}`;
  await insertChamberSession(db, {
    id: chamberSessionId,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    publicId: `chsess-pub-${SYNTHETIC_JOURNEY_RECORD_ID}`,
    recordId: SYNTHETIC_JOURNEY_RECORD_ID,
    status: "closed",
    timezone: SYNTHETIC_BODY_TIMEZONE,
    scheduledOpensAt: CHAMBER_OPENS,
    scheduledClosesAt: CHAMBER_CLOSES,
    synthetic: true,
  });
  const chamberSeats = [
    SYNTHETIC_CHAMBER_MEMBER_A_APPOINTMENT_ID,
    SYNTHETIC_CHAMBER_MEMBER_B_APPOINTMENT_ID,
    SYNTHETIC_CHAMBER_MEMBER_C_APPOINTMENT_ID,
  ] as const;
  const chamberPositions = ["yes", "no", "recused"] as const;
  const verdictId = `chver_${SYNTHETIC_JOURNEY_RECORD_ID}_v1`;
  await insertChamberVerdict(db, {
    id: verdictId,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    sessionId: chamberSessionId,
    topicGovernanceRecordId: SYNTHETIC_JOURNEY_RECORD_ID,
    version: 1,
    outcome: "accepted",
    rationale:
      "Synthetic Chamber accepted verdict. Fixture only. Not a production quorum result (V2-09).",
    minorityReasoning:
      "Synthetic minority note: Chamber Member B voted no. Positions are explicit.",
    publishedAt: CHAMBER_CLOSES,
    rosterSnapshot: chamberSeats.map((appointmentId) => ({
      memberPublicId: memberPublicIdForAppointment(appointmentId),
      appointmentKind: "chamber_member",
    })),
    synthetic: true,
  });
  await insertChamberRollCalls(
    db,
    chamberSeats.map((appointmentId, index) => ({
      id: `chroll_${SYNTHETIC_JOURNEY_RECORD_ID}_${index + 1}`,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      sessionId: chamberSessionId,
      verdictVersionId: verdictId,
      appointmentId,
      memberPublicId: memberPublicIdForAppointment(appointmentId),
      position: chamberPositions[index],
      recordedAt: CHAMBER_CLOSES,
      synthetic: true,
    })),
  );

  const councilSessionId = `cnsess_${SYNTHETIC_JOURNEY_RECORD_ID}`;
  await insertCouncilSession(db, {
    id: councilSessionId,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    publicId: `cnsess-pub-${SYNTHETIC_JOURNEY_RECORD_ID}`,
    recordId: SYNTHETIC_JOURNEY_RECORD_ID,
    status: "closed",
    timezone: SYNTHETIC_BODY_TIMEZONE,
    scheduledOpensAt: COUNCIL_OPENS,
    scheduledClosesAt: COUNCIL_CLOSES,
    synthetic: true,
  });
  const councilSeats = [
    SYNTHETIC_COUNCIL_MEMBER_A_APPOINTMENT_ID,
    SYNTHETIC_COUNCIL_MEMBER_B_APPOINTMENT_ID,
    SYNTHETIC_COUNCIL_MEMBER_C_APPOINTMENT_ID,
  ] as const;
  const councilPositions = ["yes", "abstain", "absent"] as const;
  const recId = `cnrec_${SYNTHETIC_JOURNEY_RECORD_ID}_v1`;
  await insertCouncilRecommendation(db, {
    id: recId,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    sessionId: councilSessionId,
    topicGovernanceRecordId: SYNTHETIC_JOURNEY_RECORD_ID,
    version: 1,
    rationale:
      "Synthetic Council recommendations. Fixture only. Not enacted law and not a production cadence (V2-10).",
    minorityReasoning:
      "Synthetic minority note: Council Member B abstained; Member C was absent. Positions are explicit.",
    publishedAt: COUNCIL_CLOSES,
    rosterSnapshot: councilSeats.map((appointmentId) => ({
      memberPublicId: memberPublicIdForAppointment(appointmentId),
      appointmentKind: "council_member",
    })),
    synthetic: true,
  });
  await insertCouncilRollCalls(
    db,
    councilSeats.map((appointmentId, index) => ({
      id: `cnroll_${SYNTHETIC_JOURNEY_RECORD_ID}_${index + 1}`,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      sessionId: councilSessionId,
      recommendationVersionId: recId,
      appointmentId,
      memberPublicId: memberPublicIdForAppointment(appointmentId),
      position: councilPositions[index],
      recordedAt: COUNCIL_CLOSES,
      synthetic: true,
    })),
  );
}
