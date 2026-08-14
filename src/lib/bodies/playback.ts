/**
 * Seed/playback-only Chamber and Council fixture path.
 * trustedSystem: true is used only for system_from_published_rule
 * (queue_for_chamber). HTTP handlers must not import this module.
 */
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";
import { loadPrincipal } from "@/lib/authz/load-principal";
import type { FoundationDb } from "@/db/types";
import { transitionGovernanceRecord } from "@/lib/governance/service";
import { getGovernanceRecord } from "@/lib/governance/repository";
import { requireOrganizationId } from "@/lib/organizations/ids";
import type { RollCallPosition } from "@/lib/governance/contract";
import {
  insertChamberRollCalls,
  insertChamberSession,
  insertChamberVerdict,
  insertCouncilRecommendation,
  insertCouncilRollCalls,
  insertCouncilSession,
  listSeatDisplays,
  updateChamberSessionStatus,
  updateCouncilSessionStatus,
} from "@/lib/bodies/repository";
import { memberPublicIdForAppointment } from "@/lib/bodies/types";

export const SYNTHETIC_BODY_TIMEZONE = "America/Chicago";

export async function playQueueForChamber(
  db: FoundationDb,
  input: { organizationId: string; recordId: string },
): Promise<AdapterResult<{ to: string }>> {
  const organizationId = requireOrganizationId(input.organizationId);
  const record = await getGovernanceRecord(db, organizationId, input.recordId);
  if (!record?.synthetic) {
    return {
      ok: false,
      code: "BODY_PLAYBACK_NOT_SYNTHETIC",
      error: "Fixture Chamber queue is limited to synthetic seeded topics",
    };
  }
  return transitionGovernanceRecord(db, {
    principal: null,
    organizationId,
    recordId: record.id,
    action: "queue_for_chamber",
    actor: "system_from_published_rule",
    synthetic: true,
    trustedSystem: true,
  });
}

export async function playSyntheticChamberToRecommendations(
  db: FoundationDb,
  input: {
    organizationId: string;
    recordId: string;
    chamberClerkAccountId: string;
    chamberMemberAccountId: string;
    councilClerkAccountId: string;
    councilMemberAccountId: string;
    chamberOpensAt: Date;
    chamberClosesAt: Date;
    councilOpensAt: Date;
    councilClosesAt: Date;
    chamberPositions: RollCallPosition[];
    councilPositions: RollCallPosition[];
    chamberRationale: string;
    councilRationale: string;
    minorityReasoning?: string | null;
  },
): Promise<AdapterResult<{ to: string }>> {
  const organizationId = requireOrganizationId(input.organizationId);
  const queued = await playQueueForChamber(db, {
    organizationId,
    recordId: input.recordId,
  });
  if (!queued.ok) {
    return queued;
  }

  const chamberClerk = await loadPrincipal(db, input.chamberClerkAccountId);
  const started = await transitionGovernanceRecord(db, {
    principal: chamberClerk,
    organizationId,
    recordId: input.recordId,
    action: "start_chamber_deliberation",
    actor: "chamber_clerk",
    synthetic: true,
  });
  if (!started.ok) {
    return started;
  }

  const sessionId = `chsess_${input.recordId}`;
  await insertChamberSession(db, {
    id: sessionId,
    organizationId,
    publicId: `chsess-pub-${input.recordId}`,
    recordId: input.recordId,
    status: "in_session",
    timezone: SYNTHETIC_BODY_TIMEZONE,
    scheduledOpensAt: input.chamberOpensAt,
    scheduledClosesAt: input.chamberClosesAt,
    synthetic: true,
  });

  const chamberSeats = (
    await listSeatDisplays(db, organizationId, ["chamber_member"])
  ).sort((a, b) => a.appointmentId.localeCompare(b.appointmentId));
  if (chamberSeats.length !== input.chamberPositions.length) {
    return {
      ok: false,
      code: "ROLL_CALL_INCOMPLETE",
      error: "Synthetic Chamber playback requires one position per voting seat",
    };
  }
  const chamberPublishedAt = input.chamberClosesAt;
  const verdictId = `chver_${input.recordId}_v1`;
  await insertChamberVerdict(db, {
    id: verdictId,
    organizationId,
    sessionId,
    topicGovernanceRecordId: input.recordId,
    version: 1,
    outcome: "accepted",
    rationale: input.chamberRationale,
    minorityReasoning: input.minorityReasoning ?? null,
    publishedAt: chamberPublishedAt,
    rosterSnapshot: chamberSeats.map((seat) => ({
      memberPublicId: memberPublicIdForAppointment(seat.appointmentId),
      appointmentKind: seat.appointmentKind,
    })),
    synthetic: true,
  });
  await insertChamberRollCalls(
    db,
    chamberSeats.map((seat, index) => ({
      id: `chroll_${input.recordId}_${index + 1}`,
      organizationId,
      sessionId,
      verdictVersionId: verdictId,
      appointmentId: seat.appointmentId,
      memberPublicId: memberPublicIdForAppointment(seat.appointmentId),
      position: input.chamberPositions[index],
      recordedAt: chamberPublishedAt,
      synthetic: true,
    })),
  );
  await updateChamberSessionStatus(db, {
    organizationId,
    sessionId,
    status: "closed",
  });

  const chamberMember = await loadPrincipal(db, input.chamberMemberAccountId);
  const accepted = await transitionGovernanceRecord(db, {
    principal: chamberMember,
    organizationId,
    recordId: input.recordId,
    action: "record_chamber_acceptance",
    actor: "chamber",
    verdict: {
      version: 1,
      outcome: "accepted",
      rationale: input.chamberRationale,
    },
    synthetic: true,
  });
  if (!accepted.ok) {
    return accepted;
  }

  const councilMember = await loadPrincipal(db, input.councilMemberAccountId);
  const intake = await transitionGovernanceRecord(db, {
    principal: councilMember,
    organizationId,
    recordId: input.recordId,
    action: "accept_to_council_agenda",
    actor: "council",
    synthetic: true,
  });
  if (!intake.ok) {
    return intake;
  }

  const councilSessionId = `cnsess_${input.recordId}`;
  await insertCouncilSession(db, {
    id: councilSessionId,
    organizationId,
    publicId: `cnsess-pub-${input.recordId}`,
    recordId: input.recordId,
    status: "scheduled",
    timezone: SYNTHETIC_BODY_TIMEZONE,
    scheduledOpensAt: input.councilOpensAt,
    scheduledClosesAt: input.councilClosesAt,
    synthetic: true,
  });

  const councilClerk = await loadPrincipal(db, input.councilClerkAccountId);
  const councilStarted = await transitionGovernanceRecord(db, {
    principal: councilClerk,
    organizationId,
    recordId: input.recordId,
    action: "start_council_deliberation",
    actor: "council_clerk",
    synthetic: true,
  });
  if (!councilStarted.ok) {
    return councilStarted;
  }
  await updateCouncilSessionStatus(db, {
    organizationId,
    sessionId: councilSessionId,
    status: "in_session",
  });

  const councilSeats = (
    await listSeatDisplays(db, organizationId, ["council_member"])
  ).sort((a, b) => a.appointmentId.localeCompare(b.appointmentId));
  if (councilSeats.length !== input.councilPositions.length) {
    return {
      ok: false,
      code: "ROLL_CALL_INCOMPLETE",
      error: "Synthetic Council playback requires one position per voting seat",
    };
  }
  const recId = `cnrec_${input.recordId}_v1`;
  await insertCouncilRecommendation(db, {
    id: recId,
    organizationId,
    sessionId: councilSessionId,
    topicGovernanceRecordId: input.recordId,
    version: 1,
    rationale: input.councilRationale,
    minorityReasoning: input.minorityReasoning ?? null,
    publishedAt: input.councilClosesAt,
    rosterSnapshot: councilSeats.map((seat) => ({
      memberPublicId: memberPublicIdForAppointment(seat.appointmentId),
      appointmentKind: seat.appointmentKind,
    })),
    synthetic: true,
  });
  await insertCouncilRollCalls(
    db,
    councilSeats.map((seat, index) => ({
      id: `cnroll_${input.recordId}_${index + 1}`,
      organizationId,
      sessionId: councilSessionId,
      recommendationVersionId: recId,
      appointmentId: seat.appointmentId,
      memberPublicId: memberPublicIdForAppointment(seat.appointmentId),
      position: input.councilPositions[index],
      recordedAt: input.councilClosesAt,
      synthetic: true,
    })),
  );
  await updateCouncilSessionStatus(db, {
    organizationId,
    sessionId: councilSessionId,
    status: "closed",
  });

  const published = await transitionGovernanceRecord(db, {
    principal: councilMember,
    organizationId,
    recordId: input.recordId,
    action: "publish_recommendations",
    actor: "council",
    verdict: {
      version: 1,
      outcome: "recommendations_published",
      rationale: input.councilRationale,
    },
    synthetic: true,
  });
  if (!published.ok) {
    return published;
  }
  void newEntityId;
  return published;
}
