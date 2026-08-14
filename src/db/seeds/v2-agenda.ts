import { eq } from "drizzle-orm";

import {
  commonsDiscussions,
  publicInputConversations,
  publicInputConversationTransitions,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import {
  insertGovernanceEvent,
  insertGovernanceRecord,
  updateGovernanceRecordState,
} from "@/lib/governance/repository";
import {
  playFixtureConsultationClose,
  syntheticMetricsSnapshot,
  type FixtureCloseAction,
} from "@/lib/agenda/playback";
import { GOVERNANCE_CONTRACT } from "@/lib/governance/contract";
import {
  SYNTHETIC_ORG_ALPHA_CONFIG_ID,
  SYNTHETIC_ORG_ALPHA_ID,
} from "@/db/seeds/v2-organizations";
import { assertOrganizationMutationAllowed } from "@/lib/v2/flags";

export const SYNTHETIC_AGENDA_AUTHOR_ACCOUNT_ID = "account-ostt-synth-ada";
export const SYNTHETIC_AGENDA_OPEN_SLUG = "ostt-synth-evening-transit";
export const SYNTHETIC_AGENDA_OPEN_PUBLIC_ID = "gov-ostt-synth-alpha-transit";
export const SYNTHETIC_AGENDA_OPEN_RECORD_ID = "govrec_ostt_synth_alpha_transit";
export const SYNTHETIC_AGENDA_OPEN_STATEMENT_ID =
  "stmt-ostt-synth-transit-frequency";
export const SYNTHETIC_AGENDA_CEDAR_SLUG = "ostt-synth-cedar-billing";
export const SYNTHETIC_AGENDA_ACCEPTED_SLUG = "ostt-synth-library-hours";
export const SYNTHETIC_AGENDA_DISPUTED_SLUG = "ostt-synth-river-path";
export const SYNTHETIC_AGENDA_INCONCLUSIVE_SLUG = "ostt-synth-weekend-markets";
export const SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID =
  "govrec_ostt_synth_alpha_library";
export const SYNTHETIC_AGENDA_DISPUTED_RECORD_ID = "govrec_ostt_synth_alpha_river";
export const SYNTHETIC_AGENDA_INCONCLUSIVE_RECORD_ID =
  "govrec_ostt_synth_alpha_markets";

const CREATED_AT = new Date("2026-08-12T15:00:00.000Z");
const QUALIFIED_AT = new Date("2026-08-12T16:00:00.000Z");

const TRANSIT_STATEMENTS = [
  {
    publicId: SYNTHETIC_AGENDA_OPEN_STATEMENT_ID,
    text: "Synthetic statement: evening bus frequency should increase on weekdays.",
  },
  {
    publicId: "stmt-ostt-synth-transit-hub",
    text: "Synthetic statement: timed transfers at the river hub would reduce wait time.",
  },
  {
    publicId: "stmt-ostt-synth-transit-pass",
    text: "Synthetic statement: a monthly pass should cover evening service without a surcharge.",
  },
] as const;

function syntheticEvidence(
  title: string,
  qualityStatus: "accepted" | "limited" | "disputed" | "pending",
) {
  return {
    labeledSynthetic: true as const,
    items: [
      {
        title,
        summary:
          "Synthetic seed evidence copy. Not derived from consultation votes.",
        qualityStatus,
        limitations:
          "Synthetic fixture. Evidence quality is independent of consultation popularity.",
      },
      {
        title: `${title} (counter note)`,
        summary: "Synthetic counterevidence copy for the Evidence tab.",
        qualityStatus: "limited" as const,
        limitations:
          "Synthetic fixture. Quality is not reordered by agree counts.",
      },
    ],
  };
}

async function seedQualifiedRecord(
  db: FoundationDb,
  input: {
    id: string;
    publicId: string;
    slug: string;
    title: string;
    question: string;
    overview: string;
    providerEntityId: string;
    statements: Array<{ publicId: string; text: string }>;
    evidenceTitle: string;
    legacyTopicId?: string | null;
    fixtureConversationId?: string | null;
  },
): Promise<void> {
  await insertGovernanceRecord(db, {
    id: input.id,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    publicId: input.publicId,
    state: "qualified_consultation",
    configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
    authorAccountId: SYNTHETIC_AGENDA_AUTHOR_ACCOUNT_ID,
    slug: input.slug,
    title: input.title,
    question: input.question,
    overview: input.overview,
    syntheticEvidence: syntheticEvidence(input.evidenceTitle, "limited"),
    syntheticStatements: input.statements,
    legacyTopicId: input.legacyTopicId ?? null,
    fixtureConversationId: input.fixtureConversationId ?? null,
    currentProviderEntityId: input.providerEntityId,
    synthetic: true,
  });
  await insertGovernanceEvent(db, {
    id: `${input.id}_evt_qualify`,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    recordId: input.id,
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
}

async function closeSeededTopic(
  db: FoundationDb,
  input: {
    recordId: string;
    action: FixtureCloseAction;
    participationCount: number;
  },
): Promise<void> {
  let kernelAllowed = false;
  try {
    assertOrganizationMutationAllowed();
    kernelAllowed = true;
  } catch {
    kernelAllowed = false;
  }
  if (kernelAllowed) {
    const played = await playFixtureConsultationClose(db, {
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      recordId: input.recordId,
      action: input.action,
      participationCount: input.participationCount,
    });
    if (!played.ok) {
      throw new Error(`AGENDA_SEED_PLAYBACK:${input.action}:${played.code}`);
    }
    return;
  }

  const snapshot = syntheticMetricsSnapshot(
    input.action,
    input.participationCount,
  );
  await insertGovernanceEvent(db, {
    id: `${input.recordId}_evt_close`,
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    recordId: input.recordId,
    fromState: "qualified_consultation",
    toState: snapshot.outcome,
    action: input.action,
    actorPrincipalKind: "system",
    actorAccountId: null,
    reason: snapshot.note,
    metricsSnapshot: snapshot,
    configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
    ruleVersion: GOVERNANCE_CONTRACT.schemaVersion,
    at: new Date("2026-08-13T12:00:00.000Z"),
    synthetic: true,
  });
  await updateGovernanceRecordState(db, {
    organizationId: SYNTHETIC_ORG_ALPHA_ID,
    recordId: input.recordId,
    state: snapshot.outcome,
  });
}

/**
 * Labeled synthetic Public Agenda catalog for the alpha hall.
 * Hideable via COMMONHALL_SYNTHETIC_SEED=off.
 * Hosted Pol.is is not configured. Fixture close uses trustedSystem only from
 * the playback service when the kernel is allowed.
 */
export async function seedV2Agenda(db: FoundationDb): Promise<void> {
  await db.insert(publicInputConversations).values({
    id: "pinconv_ostt_synth_alpha_cedar",
    topicId: "topic-ostt-synth-cedar-billing",
    providerKind: "fixture",
    providerConversationRef: null,
    workflowState: "open",
    providerAvailability: "unavailable",
    publicTitle: "Synthetic fixture consultation: Cedar River billing",
    publicPrompt:
      "Synthetic seed. Hosted Pol.is is unavailable. Members may record in-house positions on labeled synthetic statements.",
    configurationVersion: 1,
    opensAt: CREATED_AT,
    closesAt: new Date("2026-09-12T15:00:00.000Z"),
    version: 1,
    createdByAccountId: "account-ostt-synth-staff-admin",
    lastTransitionByAccountId: "account-ostt-synth-staff-admin",
    designation: "current",
    synthetic: true,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
  await db.insert(publicInputConversationTransitions).values({
    id: "pintr_ostt_synth_alpha_cedar_open",
    conversationId: "pinconv_ostt_synth_alpha_cedar",
    fromState: "draft",
    toState: "open",
    reason: "Synthetic seed fixture conversation. Live Pol.is remains disabled.",
    actorAccountId: "account-ostt-synth-staff-admin",
    isRecovery: false,
    synthetic: true,
    createdAt: CREATED_AT,
  });

  await seedQualifiedRecord(db, {
    id: SYNTHETIC_AGENDA_OPEN_RECORD_ID,
    publicId: SYNTHETIC_AGENDA_OPEN_PUBLIC_ID,
    slug: SYNTHETIC_AGENDA_OPEN_SLUG,
    title: "Synthetic qualified topic: evening transit reliability",
    question: "Should evening bus frequency increase on weekdays?",
    overview:
      "Synthetic seed. This topic is in qualified_consultation on the Public Agenda. Hosted Pol.is is unavailable. In-house agree, disagree, and pass controls write only to Commonhall.",
    providerEntityId: "pvent_ostt_synth_alpha_transit",
    statements: [...TRANSIT_STATEMENTS],
    evidenceTitle: "Synthetic transit operations memo",
  });

  await seedQualifiedRecord(db, {
    id: "govrec_ostt_synth_alpha_cedar",
    publicId: "gov-ostt-synth-alpha-cedar",
    slug: SYNTHETIC_AGENDA_CEDAR_SLUG,
    title: "Synthetic qualified topic: Cedar River billing operations",
    question:
      "Should the synthetic Cedar River utility publish a clearer billing operations timeline?",
    overview:
      "Synthetic seed linked to a legacy topic for evidence tables. Evidence quality is not reordered by consultation positions. One fixture provider entity; hosted Pol.is is not loaded.",
    providerEntityId: "pvent_ostt_synth_alpha_cedar",
    statements: [
      {
        publicId: "stmt-ostt-synth-cedar-timeline",
        text: "Synthetic statement: publish a clearer billing operations timeline.",
      },
    ],
    evidenceTitle: "Unused when legacy evidence is linked",
    legacyTopicId: "topic-ostt-synth-cedar-billing",
    fixtureConversationId: "pinconv_ostt_synth_alpha_cedar",
  });

  await seedQualifiedRecord(db, {
    id: SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID,
    publicId: "gov-ostt-synth-alpha-library",
    slug: SYNTHETIC_AGENDA_ACCEPTED_SLUG,
    title: "Synthetic qualified topic: weekend library hours",
    question: "Should weekend library hours extend into the evening?",
    overview:
      "Synthetic seed closed as community_accepted by fixture playback. Not a production threshold (V2-07).",
    providerEntityId: "pvent_ostt_synth_alpha_library",
    statements: [
      {
        publicId: "stmt-ostt-synth-library-hours",
        text: "Synthetic statement: extend Saturday library hours.",
      },
    ],
    evidenceTitle: "Synthetic library usage note",
  });

  await seedQualifiedRecord(db, {
    id: SYNTHETIC_AGENDA_DISPUTED_RECORD_ID,
    publicId: "gov-ostt-synth-alpha-river",
    slug: SYNTHETIC_AGENDA_DISPUTED_SLUG,
    title: "Synthetic qualified topic: river path lighting",
    question: "Should path lighting be added along the river walk?",
    overview:
      "Synthetic seed closed as community_disputed by fixture playback. Disputed topics remain on the Public Agenda.",
    providerEntityId: "pvent_ostt_synth_alpha_river",
    statements: [
      {
        publicId: "stmt-ostt-synth-river-lighting",
        text: "Synthetic statement: add lighting on the river path.",
      },
    ],
    evidenceTitle: "Synthetic river path safety note",
  });

  await seedQualifiedRecord(db, {
    id: SYNTHETIC_AGENDA_INCONCLUSIVE_RECORD_ID,
    publicId: "gov-ostt-synth-alpha-markets",
    slug: SYNTHETIC_AGENDA_INCONCLUSIVE_SLUG,
    title: "Synthetic qualified topic: weekend markets",
    question: "Should the hall host a weekend produce market?",
    overview:
      "Synthetic seed closed as consultation_inconclusive by fixture playback. Inconclusive topics remain on the Public Agenda.",
    providerEntityId: "pvent_ostt_synth_alpha_markets",
    statements: [
      {
        publicId: "stmt-ostt-synth-weekend-market",
        text: "Synthetic statement: host a weekend produce market.",
      },
    ],
    evidenceTitle: "Synthetic market operations note",
  });

  await closeSeededTopic(db, {
    recordId: SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID,
    action: "close_as_accepted",
    participationCount: 18,
  });
  await closeSeededTopic(db, {
    recordId: SYNTHETIC_AGENDA_DISPUTED_RECORD_ID,
    action: "close_as_disputed",
    participationCount: 11,
  });
  await closeSeededTopic(db, {
    recordId: SYNTHETIC_AGENDA_INCONCLUSIVE_RECORD_ID,
    action: "close_as_inconclusive",
    participationCount: 4,
  });

  await db
    .update(commonsDiscussions)
    .set({ topicGovernanceRecordId: SYNTHETIC_AGENDA_OPEN_RECORD_ID })
    .where(eq(commonsDiscussions.id, "cdisc_ostt_synth_alpha_qualified_topic"));
}
