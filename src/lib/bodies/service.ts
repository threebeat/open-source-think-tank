import type { AdapterResult } from "@/lib/adapters/types";
import { appendAuthAudit } from "@/lib/auth/audit-log";
import { newEntityId } from "@/lib/auth/tokens";
import type { AuthzPrincipal } from "@/lib/authz/types";
import type { FoundationDb } from "@/db/types";
import {
  CHAMBER_STATES,
  COUNCIL_AGENDA_STATES,
  RECORDS_STATES,
  governanceStateMeta,
  isChamberState,
  isCouncilAgendaState,
  isRecordsState,
  isRollCallPosition,
  type RollCallPosition,
  type TopicGovernanceAction,
} from "@/lib/governance/contract";
import {
  getGovernanceRecordBySlugOrPublicId,
  listGovernanceRecordsByStates,
} from "@/lib/governance/repository";
import { transitionGovernanceRecord } from "@/lib/governance/service";
import { requireOrganizationId } from "@/lib/organizations/ids";
import { getOrganization } from "@/lib/organizations/repository";
import { getMutationRateLimiter } from "@/lib/security/mutation-rate-limit";
import {
  assertOrganizationMutationAllowed,
  isSyntheticSeedEnabled,
} from "@/lib/v2/flags";
import {
  getChamberSessionForTopic,
  getCouncilSessionForTopic,
  getLatestChamberVerdict,
  getLatestCouncilRecommendation,
  insertChamberRollCalls,
  insertChamberVerdict,
  insertCouncilRecommendation,
  insertCouncilRollCalls,
  insertCouncilSession,
  listChamberRollCalls,
  listConflictsForRecord,
  listCouncilRollCalls,
  listSeatDisplays,
  updateChamberSessionStatus,
  updateCouncilSessionStatus,
  type SeatDisplay,
} from "@/lib/bodies/repository";
import {
  assertPublicProjection,
  recommendationToDto,
  rollCallToDto,
  rosterToDto,
  sessionToDto,
  stateLabel,
  toBodyListItem,
  verdictToDto,
  viewerSeat,
} from "@/lib/bodies/projection";
import {
  memberPublicIdForAppointment,
  type BodyListDto,
  type ChamberTopicDetailDto,
  type CouncilTopicDetailDto,
  type RecordsTopicDetailDto,
} from "@/lib/bodies/types";

const CHAMBER_ROSTER_KINDS = ["chamber_member", "chamber_clerk"] as const;
const COUNCIL_ROSTER_KINDS = ["council_member", "council_clerk"] as const;
const CHAMBER_VOTING_KIND = "chamber_member" as const;
const COUNCIL_VOTING_KIND = "council_member" as const;

function hasMatchingAppointment(
  principal: AuthzPrincipal | null | undefined,
  organizationId: string,
  kind: string,
): boolean {
  return (principal?.organizationAppointments ?? []).some(
    (row) => row.organizationId === organizationId && row.kind === kind,
  );
}

function syntheticCatalog(): boolean {
  return isSyntheticSeedEnabled();
}

export async function listChamber(
  db: FoundationDb,
  input: { principal: AuthzPrincipal | null; organizationId: string },
): Promise<AdapterResult<BodyListDto>> {
  void input.principal;
  const organizationId = requireOrganizationId(input.organizationId);
  const includeSynthetic = syntheticCatalog();
  const rows = await listGovernanceRecordsByStates(
    db,
    organizationId,
    [...CHAMBER_STATES, ...RECORDS_STATES],
    { includeSynthetic },
  );
  const roster = await listSeatDisplays(db, organizationId, CHAMBER_ROSTER_KINDS);
  const value: BodyListDto = {
    topics: rows
      .map(toBodyListItem)
      .filter((row): row is NonNullable<typeof row> => row !== null),
    roster: rosterToDto(roster),
    syntheticCatalog: includeSynthetic,
    hostedPolisEnabled: false,
  };
  assertPublicProjection(value);
  return { ok: true, value };
}

export async function listCouncil(
  db: FoundationDb,
  input: { principal: AuthzPrincipal | null; organizationId: string },
): Promise<AdapterResult<BodyListDto>> {
  void input.principal;
  const organizationId = requireOrganizationId(input.organizationId);
  const includeSynthetic = syntheticCatalog();
  const rows = await listGovernanceRecordsByStates(
    db,
    organizationId,
    [
      "chamber_accepted",
      "chamber_disputed",
      ...COUNCIL_AGENDA_STATES,
      "council_declined",
      ...RECORDS_STATES,
    ],
    { includeSynthetic },
  );
  const roster = await listSeatDisplays(db, organizationId, COUNCIL_ROSTER_KINDS);
  const value: BodyListDto = {
    topics: rows
      .map(toBodyListItem)
      .filter((row): row is NonNullable<typeof row> => row !== null),
    roster: rosterToDto(roster),
    syntheticCatalog: includeSynthetic,
    hostedPolisEnabled: false,
  };
  assertPublicProjection(value);
  return { ok: true, value };
}

export async function listRecords(
  db: FoundationDb,
  input: { principal: AuthzPrincipal | null; organizationId: string },
): Promise<AdapterResult<BodyListDto>> {
  void input.principal;
  const organizationId = requireOrganizationId(input.organizationId);
  const includeSynthetic = syntheticCatalog();
  const rows = await listGovernanceRecordsByStates(
    db,
    organizationId,
    RECORDS_STATES,
    { includeSynthetic },
  );
  const value: BodyListDto = {
    topics: rows
      .map(toBodyListItem)
      .filter((row): row is NonNullable<typeof row> => row !== null),
    roster: [],
    syntheticCatalog: includeSynthetic,
    hostedPolisEnabled: false,
  };
  assertPublicProjection(value);
  return { ok: true, value };
}

export async function getChamberTopic(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    slugOrPublicId: string;
  },
): Promise<AdapterResult<ChamberTopicDetailDto>> {
  const organizationId = requireOrganizationId(input.organizationId);
  const row = await loadVisibleRecord(
    db,
    organizationId,
    input.slugOrPublicId,
    () => true,
  );
  if (!row.ok) {
    return row;
  }
  const record = row.value;
  const session = await getChamberSessionForTopic(db, organizationId, record.id);
  if (!isChamberState(record.state) && !session) {
    return {
      ok: false,
      code: "CHAMBER_TOPIC_NOT_FOUND",
      error: "Chamber topic not found in this organization",
    };
  }

  const seats = await listSeatDisplays(db, organizationId, CHAMBER_ROSTER_KINDS);
  const verdict = session
    ? await getLatestChamberVerdict(db, organizationId, session.id)
    : null;
  const rollRows = verdict
    ? await listChamberRollCalls(db, organizationId, verdict.id)
    : [];
  const conflicts = await listConflictsForRecord(db, organizationId, record.id);
  const voter = viewerSeat(input.principal, organizationId, seats, CHAMBER_VOTING_KIND);
  const dto: ChamberTopicDetailDto = {
    publicId: record.publicId,
    slug: record.slug ?? record.publicId,
    title: record.title ?? record.publicId,
    question: record.question,
    overview: record.overview,
    state: record.state,
    stateLabel: stateLabel(record.state),
    realm: governanceStateMeta(record.state)?.realm ?? "chamber",
    synthetic: record.synthetic,
    publicAgenda: governanceStateMeta(record.state)?.publicAgenda ?? false,
    hostedPolisEnabled: false,
    session: session ? sessionToDto(session) : null,
    roster: rosterToDto(seats),
    conflicts: conflicts.map((item) => ({
      memberPublicId: memberPublicIdForAppointment(item.appointmentId),
      kind: item.kind,
      reason: item.reason,
    })),
    verdict: verdict ? verdictToDto(verdict) : null,
    rollCall: verdict
      ? rollCallToDto({
          rows: rollRows,
          seats,
          body: "chamber",
          topicPublicId: record.publicId,
          verdictVersion: verdict.version,
        })
      : [],
    viewerCanVote:
      Boolean(voter) && record.state === "chamber_deliberating",
    viewerMemberPublicId: voter
      ? memberPublicIdForAppointment(voter.appointmentId)
      : null,
  };
  assertPublicProjection(dto);
  return { ok: true, value: dto };
}

export async function getCouncilTopic(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    slugOrPublicId: string;
  },
): Promise<AdapterResult<CouncilTopicDetailDto>> {
  const organizationId = requireOrganizationId(input.organizationId);
  const row = await loadVisibleRecord(
    db,
    organizationId,
    input.slugOrPublicId,
    (state) =>
      isCouncilAgendaState(state) ||
      isRecordsState(state) ||
      state === "chamber_accepted" ||
      state === "chamber_disputed" ||
      state === "council_declined",
  );
  if (!row.ok) {
    return row;
  }
  const record = row.value;
  const onCouncil =
    isCouncilAgendaState(record.state) ||
    isRecordsState(record.state) ||
    record.state === "council_declined" ||
    record.state === "chamber_accepted" ||
    record.state === "chamber_disputed";
  if (!onCouncil) {
    return {
      ok: false,
      code: "COUNCIL_TOPIC_NOT_FOUND",
      error: "Council topic not found in this organization",
    };
  }

  const seats = await listSeatDisplays(db, organizationId, COUNCIL_ROSTER_KINDS);
  const session = await getCouncilSessionForTopic(db, organizationId, record.id);
  const recommendation = session
    ? await getLatestCouncilRecommendation(db, organizationId, session.id)
    : null;
  const rollRows = recommendation
    ? await listCouncilRollCalls(db, organizationId, recommendation.id)
    : [];
  const conflicts = await listConflictsForRecord(db, organizationId, record.id);
  const voter = viewerSeat(input.principal, organizationId, seats, COUNCIL_VOTING_KIND);
  const meta = governanceStateMeta(record.state);
  const dto: CouncilTopicDetailDto = {
    publicId: record.publicId,
    slug: record.slug ?? record.publicId,
    title: record.title ?? record.publicId,
    question: record.question,
    overview: record.overview,
    state: record.state,
    stateLabel: stateLabel(record.state),
    realm: meta?.realm ?? "council_agenda",
    synthetic: record.synthetic,
    publicAgenda: meta?.publicAgenda ?? false,
    hostedPolisEnabled: false,
    session: session ? sessionToDto(session) : null,
    roster: rosterToDto(seats),
    conflicts: conflicts.map((item) => ({
      memberPublicId: memberPublicIdForAppointment(item.appointmentId),
      kind: item.kind,
      reason: item.reason,
    })),
    intakeReason: session?.intakeReason ?? null,
    recommendation: recommendation ? recommendationToDto(recommendation) : null,
    rollCall: recommendation
      ? rollCallToDto({
          rows: rollRows,
          seats,
          body: "council",
          topicPublicId: record.publicId,
          verdictVersion: recommendation.version,
        })
      : [],
    viewerCanVote:
      Boolean(voter) && record.state === "council_deliberating",
    viewerMemberPublicId: voter
      ? memberPublicIdForAppointment(voter.appointmentId)
      : null,
  };
  assertPublicProjection(dto);
  return { ok: true, value: dto };
}

export async function getRecordsTopic(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    slugOrPublicId: string;
  },
): Promise<AdapterResult<RecordsTopicDetailDto>> {
  void input.principal;
  const organizationId = requireOrganizationId(input.organizationId);
  const row = await loadVisibleRecord(
    db,
    organizationId,
    input.slugOrPublicId,
    isRecordsState,
  );
  if (!row.ok) {
    return row;
  }
  const record = row.value;
  const chamberSeats = await listSeatDisplays(
    db,
    organizationId,
    CHAMBER_ROSTER_KINDS,
  );
  const councilSeats = await listSeatDisplays(
    db,
    organizationId,
    COUNCIL_ROSTER_KINDS,
  );
  const chamberSession = await getChamberSessionForTopic(
    db,
    organizationId,
    record.id,
  );
  const councilSession = await getCouncilSessionForTopic(
    db,
    organizationId,
    record.id,
  );
  const verdict = chamberSession
    ? await getLatestChamberVerdict(db, organizationId, chamberSession.id)
    : null;
  const recommendation = councilSession
    ? await getLatestCouncilRecommendation(db, organizationId, councilSession.id)
    : null;
  const chamberRoll = verdict
    ? await listChamberRollCalls(db, organizationId, verdict.id)
    : [];
  const councilRoll = recommendation
    ? await listCouncilRollCalls(db, organizationId, recommendation.id)
    : [];
  const dto: RecordsTopicDetailDto = {
    publicId: record.publicId,
    slug: record.slug ?? record.publicId,
    title: record.title ?? record.publicId,
    question: record.question,
    overview: record.overview,
    state: record.state,
    stateLabel: stateLabel(record.state),
    realm: "records",
    synthetic: record.synthetic,
    publicAgenda: false,
    hostedPolisEnabled: false,
    chamberVerdict: verdict ? verdictToDto(verdict) : null,
    chamberRollCall: verdict
      ? rollCallToDto({
          rows: chamberRoll,
          seats: chamberSeats,
          body: "chamber",
          topicPublicId: record.publicId,
          verdictVersion: verdict.version,
        })
      : [],
    councilRecommendation: recommendation
      ? recommendationToDto(recommendation)
      : null,
    councilRollCall: recommendation
      ? rollCallToDto({
          rows: councilRoll,
          seats: councilSeats,
          body: "council",
          topicPublicId: record.publicId,
          verdictVersion: recommendation.version,
        })
      : [],
  };
  assertPublicProjection(dto);
  return { ok: true, value: dto };
}

export async function publishChamberVerdict(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    slugOrPublicId: string;
    outcome: "accepted" | "disputed";
    rationale: string;
    minorityReasoning?: string | null;
    rollCall: Array<{ memberPublicId: string; position: string }>;
    clientIp?: string | null;
  },
): Promise<AdapterResult<{ to: string }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  const denied = denyUntrustedSystem(input);
  if (denied) {
    return denied;
  }
  if (!hasMatchingAppointment(input.principal, organizationId, CHAMBER_VOTING_KIND)) {
    return {
      ok: false,
      code: "AUTHZ_DENIED",
      error: "A Chamber member appointment is required to record a Chamber verdict",
    };
  }
  const limited = rateLimit(input.principal?.accountId, input.clientIp);
  if (!limited.ok) {
    return limited;
  }

  const recordResult = await loadVisibleRecord(
    db,
    organizationId,
    input.slugOrPublicId,
    (state) => state === "chamber_deliberating",
  );
  if (!recordResult.ok) {
    return recordResult;
  }
  const record = recordResult.value;
  const session = await getChamberSessionForTopic(db, organizationId, record.id);
  if (!session) {
    return {
      ok: false,
      code: "CHAMBER_SESSION_NOT_FOUND",
      error: "No Chamber session exists for this topic",
    };
  }
  const seats = (await listSeatDisplays(db, organizationId, CHAMBER_ROSTER_KINDS)).filter(
    (seat) => seat.appointmentKind === CHAMBER_VOTING_KIND,
  );
  const checked = completeRollCall(seats, input.rollCall);
  if (!checked.ok) {
    return checked;
  }

  const publishedAt = new Date();
  const verdictId = newEntityId("chver");
  const rosterSnapshot = seats.map((seat) => ({
    memberPublicId: memberPublicIdForAppointment(seat.appointmentId),
    appointmentKind: seat.appointmentKind,
  }));
  await insertChamberVerdict(db, {
    id: verdictId,
    organizationId,
    sessionId: session.id,
    topicGovernanceRecordId: record.id,
    version: 1,
    outcome: input.outcome,
    rationale: input.rationale.trim(),
    minorityReasoning: input.minorityReasoning?.trim() || null,
    publishedAt,
    rosterSnapshot,
    synthetic: record.synthetic,
  });
  await insertChamberRollCalls(
    db,
    checked.value.map((entry) => ({
      id: newEntityId("chroll"),
      organizationId,
      sessionId: session.id,
      verdictVersionId: verdictId,
      appointmentId: entry.appointmentId,
      memberPublicId: entry.memberPublicId,
      position: entry.position,
      recordedAt: publishedAt,
      synthetic: record.synthetic,
    })),
  );
  await updateChamberSessionStatus(db, {
    organizationId,
    sessionId: session.id,
    status: "closed",
  });

  const action: TopicGovernanceAction =
    input.outcome === "accepted"
      ? "record_chamber_acceptance"
      : "record_chamber_dispute";
  const transitioned = await transitionGovernanceRecord(db, {
    principal: input.principal,
    organizationId,
    recordId: record.id,
    action,
    actor: "chamber",
    verdict: {
      version: 1,
      outcome: input.outcome,
      rationale: input.rationale.trim(),
    },
    synthetic: record.synthetic,
  });
  if (!transitioned.ok) {
    return transitioned;
  }
  await auditBody(db, {
    principal: input.principal,
    organizationId,
    recordId: record.id,
    action: "chamber.verdict.published",
    synthetic: record.synthetic,
  });
  return transitioned;
}

export async function recordCouncilIntake(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    slugOrPublicId: string;
    action:
      | "accept_to_council_agenda"
      | "decline_council_intake"
      | "accept_disputed_to_council_agenda"
      | "decline_disputed_council_intake";
    reason?: string | null;
    clientIp?: string | null;
  },
): Promise<AdapterResult<{ to: string }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  const denied = denyUntrustedSystem(input);
  if (denied) {
    return denied;
  }
  if (!hasMatchingAppointment(input.principal, organizationId, COUNCIL_VOTING_KIND)) {
    return {
      ok: false,
      code: "AUTHZ_DENIED",
      error: "A Council member appointment is required to record intake",
    };
  }
  const limited = rateLimit(input.principal?.accountId, input.clientIp);
  if (!limited.ok) {
    return limited;
  }

  const expectedFrom =
    input.action === "accept_to_council_agenda" ||
    input.action === "decline_council_intake"
      ? "chamber_accepted"
      : "chamber_disputed";
  const recordResult = await loadVisibleRecord(
    db,
    organizationId,
    input.slugOrPublicId,
    (state) => state === expectedFrom,
  );
  if (!recordResult.ok) {
    return recordResult;
  }
  const record = recordResult.value;
  const transitioned = await transitionGovernanceRecord(db, {
    principal: input.principal,
    organizationId,
    recordId: record.id,
    action: input.action,
    actor: "council",
    reason: input.reason,
    synthetic: record.synthetic,
  });
  if (!transitioned.ok) {
    return transitioned;
  }

  if (
    input.action === "accept_to_council_agenda" ||
    input.action === "accept_disputed_to_council_agenda"
  ) {
    const existing = await getCouncilSessionForTopic(db, organizationId, record.id);
    if (!existing) {
      const opens = new Date("2026-08-16T17:00:00.000Z");
      const closes = new Date("2026-08-16T19:00:00.000Z");
      await insertCouncilSession(db, {
        id: newEntityId("cnsess"),
        organizationId,
        publicId: newEntityId("cnspub"),
        recordId: record.id,
        status: "scheduled",
        timezone: "America/Chicago",
        scheduledOpensAt: opens,
        scheduledClosesAt: closes,
        intakeReason: input.reason ?? null,
        synthetic: record.synthetic,
      });
    }
  }
  return transitioned;
}

export async function publishCouncilRecommendations(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    slugOrPublicId: string;
    rationale: string;
    minorityReasoning?: string | null;
    rollCall: Array<{ memberPublicId: string; position: string }>;
    clientIp?: string | null;
  },
): Promise<AdapterResult<{ to: string }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  const denied = denyUntrustedSystem(input);
  if (denied) {
    return denied;
  }
  if (!hasMatchingAppointment(input.principal, organizationId, COUNCIL_VOTING_KIND)) {
    return {
      ok: false,
      code: "AUTHZ_DENIED",
      error:
        "A Council member appointment is required to publish recommendations",
    };
  }
  const limited = rateLimit(input.principal?.accountId, input.clientIp);
  if (!limited.ok) {
    return limited;
  }
  const recordResult = await loadVisibleRecord(
    db,
    organizationId,
    input.slugOrPublicId,
    (state) => state === "council_deliberating",
  );
  if (!recordResult.ok) {
    return recordResult;
  }
  const record = recordResult.value;
  const session = await getCouncilSessionForTopic(db, organizationId, record.id);
  if (!session) {
    return {
      ok: false,
      code: "COUNCIL_SESSION_NOT_FOUND",
      error: "No Council session exists for this topic",
    };
  }
  const seats = (await listSeatDisplays(db, organizationId, COUNCIL_ROSTER_KINDS)).filter(
    (seat) => seat.appointmentKind === COUNCIL_VOTING_KIND,
  );
  const checked = completeRollCall(seats, input.rollCall);
  if (!checked.ok) {
    return checked;
  }
  const publishedAt = new Date();
  const versionId = newEntityId("cnrec");
  await insertCouncilRecommendation(db, {
    id: versionId,
    organizationId,
    sessionId: session.id,
    topicGovernanceRecordId: record.id,
    version: 1,
    rationale: input.rationale.trim(),
    minorityReasoning: input.minorityReasoning?.trim() || null,
    publishedAt,
    rosterSnapshot: seats.map((seat) => ({
      memberPublicId: memberPublicIdForAppointment(seat.appointmentId),
      appointmentKind: seat.appointmentKind,
    })),
    synthetic: record.synthetic,
  });
  await insertCouncilRollCalls(
    db,
    checked.value.map((entry) => ({
      id: newEntityId("cnroll"),
      organizationId,
      sessionId: session.id,
      recommendationVersionId: versionId,
      appointmentId: entry.appointmentId,
      memberPublicId: entry.memberPublicId,
      position: entry.position,
      recordedAt: publishedAt,
      synthetic: record.synthetic,
    })),
  );
  await updateCouncilSessionStatus(db, {
    organizationId,
    sessionId: session.id,
    status: "closed",
  });
  const transitioned = await transitionGovernanceRecord(db, {
    principal: input.principal,
    organizationId,
    recordId: record.id,
    action: "publish_recommendations",
    actor: "council",
    verdict: {
      version: 1,
      outcome: "recommendations_published",
      rationale: input.rationale.trim(),
    },
    synthetic: record.synthetic,
  });
  if (!transitioned.ok) {
    return transitioned;
  }
  await auditBody(db, {
    principal: input.principal,
    organizationId,
    recordId: record.id,
    action: "council.recommendations.published",
    synthetic: record.synthetic,
  });
  return transitioned;
}

export async function startBodyDeliberation(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    slugOrPublicId: string;
    body: "chamber" | "council";
    clientIp?: string | null;
  },
): Promise<AdapterResult<{ to: string }>> {
  assertOrganizationMutationAllowed();
  const organizationId = requireOrganizationId(input.organizationId);
  const denied = denyUntrustedSystem(input);
  if (denied) {
    return denied;
  }
  const clerkKind =
    input.body === "chamber" ? "chamber_clerk" : "council_clerk";
  if (!hasMatchingAppointment(input.principal, organizationId, clerkKind)) {
    return {
      ok: false,
      code: "AUTHZ_DENIED",
      error: `Appointment ${clerkKind} is required to start deliberation`,
    };
  }
  const expected =
    input.body === "chamber" ? "chamber_queued" : "council_scheduled";
  const recordResult = await loadVisibleRecord(
    db,
    organizationId,
    input.slugOrPublicId,
    (state) => state === expected,
  );
  if (!recordResult.ok) {
    return recordResult;
  }
  const record = recordResult.value;
  const transitioned = await transitionGovernanceRecord(db, {
    principal: input.principal,
    organizationId,
    recordId: record.id,
    action:
      input.body === "chamber"
        ? "start_chamber_deliberation"
        : "start_council_deliberation",
    actor: input.body === "chamber" ? "chamber_clerk" : "council_clerk",
    synthetic: record.synthetic,
  });
  if (!transitioned.ok) {
    return transitioned;
  }
  if (input.body === "chamber") {
    const session = await getChamberSessionForTopic(db, organizationId, record.id);
    if (session) {
      await updateChamberSessionStatus(db, {
        organizationId,
        sessionId: session.id,
        status: "in_session",
      });
    }
  } else {
    const session = await getCouncilSessionForTopic(db, organizationId, record.id);
    if (session) {
      await updateCouncilSessionStatus(db, {
        organizationId,
        sessionId: session.id,
        status: "in_session",
      });
    }
  }
  return transitioned;
}

function completeRollCall(
  seats: SeatDisplay[],
  submitted: Array<{ memberPublicId: string; position: string }>,
): AdapterResult<
  Array<{
    appointmentId: string;
    memberPublicId: string;
    position: RollCallPosition;
  }>
> {
  const byPublicId = new Map(
    seats.map((seat) => [
      memberPublicIdForAppointment(seat.appointmentId),
      seat,
    ]),
  );
  if (submitted.length !== seats.length) {
    return {
      ok: false,
      code: "ROLL_CALL_INCOMPLETE",
      error:
        "A complete roll call is required. Every seat must have an explicit yes, no, abstain, recused, or absent position.",
    };
  }
  const seen = new Set<string>();
  const rows: Array<{
    appointmentId: string;
    memberPublicId: string;
    position: RollCallPosition;
  }> = [];
  for (const entry of submitted) {
    if (!isRollCallPosition(entry.position)) {
      return {
        ok: false,
        code: "ROLL_CALL_POSITION_INVALID",
        error: "Position must be yes, no, abstain, recused, or absent",
      };
    }
    const seat = byPublicId.get(entry.memberPublicId);
    if (!seat) {
      return {
        ok: false,
        code: "ROLL_CALL_SEAT_UNKNOWN",
        error: "Roll call includes a seat that is not on the current roster",
      };
    }
    if (seen.has(seat.appointmentId)) {
      return {
        ok: false,
        code: "ROLL_CALL_DUPLICATE_SEAT",
        error: "Each seat may appear once on a roll call",
      };
    }
    seen.add(seat.appointmentId);
    rows.push({
      appointmentId: seat.appointmentId,
      memberPublicId: entry.memberPublicId,
      position: entry.position,
    });
  }
  if (seen.size !== seats.length) {
    return {
      ok: false,
      code: "ROLL_CALL_INCOMPLETE",
      error:
        "A complete roll call is required. Absence is not inferred from a missing row.",
    };
  }
  return { ok: true, value: rows };
}

function denyUntrustedSystem(input: { principal: AuthzPrincipal | null }): AdapterResult<never> | null {
  void input;
  return null;
}

function rateLimit(
  accountId: string | undefined,
  clientIp?: string | null,
): AdapterResult<never> | { ok: true } {
  if (!accountId) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      error: "Sign in is required",
    };
  }
  const limited = getMutationRateLimiter().consume({
    family: "member_position",
    accountId,
    originRef: clientIp ?? null,
  });
  if (!limited.ok) {
    return {
      ok: false,
      code: "BODY_RATE_LIMITED",
      error: "Too many body actions. Try again shortly.",
    };
  }
  return { ok: true };
}

async function loadVisibleRecord(
  db: FoundationDb,
  organizationId: string,
  slugOrPublicId: string,
  allowed: (state: string) => boolean,
) {
  const record = await getGovernanceRecordBySlugOrPublicId(
    db,
    organizationId,
    slugOrPublicId,
  );
  if (!record || !record.slug || !record.title) {
    return {
      ok: false as const,
      code: "BODY_TOPIC_NOT_FOUND",
      error: "Topic not found in this organization",
    };
  }
  if (record.synthetic && !isSyntheticSeedEnabled()) {
    return {
      ok: false as const,
      code: "BODY_TOPIC_NOT_FOUND",
      error: "Topic not found in this organization",
    };
  }
  if (!allowed(record.state)) {
    return {
      ok: false as const,
      code: "BODY_TOPIC_NOT_FOUND",
      error: "Topic not found in this organization",
    };
  }
  return { ok: true as const, value: record };
}

async function auditBody(
  db: FoundationDb,
  input: {
    principal: AuthzPrincipal | null;
    organizationId: string;
    recordId: string;
    action: "chamber.verdict.published" | "council.recommendations.published";
    synthetic: boolean;
  },
): Promise<void> {
  const org = await getOrganization(db, input.organizationId);
  await appendAuthAudit(db, {
    actorRole: "organization_officer",
    actorAccountId: input.principal?.accountId ?? null,
    action: input.action,
    subjectType: "topic_governance_record",
    subjectId: input.recordId,
    summary:
      input.action === "chamber.verdict.published"
        ? "A Chamber verdict was published."
        : "Council recommendations were published.",
    reason: "Organization body publication with a complete roll call.",
    privatePayload: {
      organizationPublicId: org?.publicId ?? input.organizationId,
    },
    synthetic: input.synthetic,
    organizationId: input.organizationId,
    actorPrincipalKind: "organization_officer",
    projectionClass: "protected",
  });
}
