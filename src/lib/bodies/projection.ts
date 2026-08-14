import type { AuthzPrincipal } from "@/lib/authz/types";
import {
  governanceStateMeta,
  type TopicGovernanceState,
} from "@/lib/governance/contract";
import type { GovernanceRecordRow } from "@/lib/governance/repository";
import {
  memberPublicIdForAppointment,
  type BodyKind,
  type BodyTopicListItemDto,
  type RollCallRowDto,
  type RosterSeatDto,
  type SessionDto,
} from "@/lib/bodies/types";
import type {
  RecommendationRow,
  RollCallRow,
  SeatDisplay,
  SessionRow,
  VerdictRow,
} from "@/lib/bodies/repository";

const FORBIDDEN_PUBLIC_KEYS = [
  "xid",
  "XID",
  "accountId",
  "appointmentId",
  "currentProviderEntityId",
] as const;

export function assertPublicProjection(value: unknown): void {
  const json = JSON.stringify(value);
  for (const key of FORBIDDEN_PUBLIC_KEYS) {
    if (json.includes(`"${key}"`)) {
      throw new Error(`AGENDA_PROJECTION_FORBIDDEN:${key}`);
    }
  }
}

export function stateLabel(state: TopicGovernanceState): string {
  return governanceStateMeta(state)?.description ?? state;
}

export function toBodyListItem(
  row: GovernanceRecordRow,
): BodyTopicListItemDto | null {
  if (!row.slug || !row.title) {
    return null;
  }
  const meta = governanceStateMeta(row.state);
  return {
    publicId: row.publicId,
    slug: row.slug,
    title: row.title,
    question: row.question,
    state: row.state,
    stateLabel: stateLabel(row.state),
    realm: meta?.realm ?? "unknown",
    synthetic: row.synthetic,
    publicAgenda: meta?.publicAgenda ?? false,
  };
}

export function sessionToDto(row: SessionRow): SessionDto {
  return {
    publicId: row.publicId,
    status: row.status,
    timezone: row.timezone,
    scheduledOpensAt: row.scheduledOpensAt.toISOString(),
    scheduledClosesAt: row.scheduledClosesAt.toISOString(),
    synthetic: row.synthetic,
  };
}

export function rosterToDto(seats: SeatDisplay[]): RosterSeatDto[] {
  return seats.map((seat) => ({
    memberPublicId: memberPublicIdForAppointment(seat.appointmentId),
    displayName: seat.displayName,
    appointmentKind: seat.appointmentKind,
    termStartsAt: seat.termStartsAt.toISOString(),
    termEndsAt: seat.termEndsAt?.toISOString() ?? null,
  }));
}

export function rollCallToDto(input: {
  rows: RollCallRow[];
  seats: SeatDisplay[];
  body: BodyKind;
  topicPublicId: string;
  verdictVersion: number;
}): RollCallRowDto[] {
  const names = new Map(
    input.seats.map((seat) => [
      seat.appointmentId,
      seat.displayName,
    ]),
  );
  return input.rows.map((row) => ({
    memberPublicId: row.memberPublicId,
    displayName: names.get(row.appointmentId) ?? row.memberPublicId,
    position: row.position,
    recordedAt: row.recordedAt.toISOString(),
    body: input.body,
    topicPublicId: input.topicPublicId,
    verdictVersion: input.verdictVersion,
  }));
}

export function verdictToDto(row: VerdictRow) {
  return {
    version: row.version,
    outcome: row.outcome,
    rationale: row.rationale,
    minorityReasoning: row.minorityReasoning,
    publishedAt: row.publishedAt.toISOString(),
    synthetic: row.synthetic,
  };
}

export function recommendationToDto(row: RecommendationRow) {
  return {
    version: row.version,
    rationale: row.rationale,
    minorityReasoning: row.minorityReasoning,
    publishedAt: row.publishedAt.toISOString(),
    synthetic: row.synthetic,
  };
}

export function viewerSeat(
  principal: AuthzPrincipal | null | undefined,
  organizationId: string,
  seats: SeatDisplay[],
  kind: "chamber_member" | "council_member",
): SeatDisplay | null {
  if (!principal?.accountId) {
    return null;
  }
  return (
    seats.find(
      (seat) =>
        seat.accountId === principal.accountId &&
        seat.appointmentKind === kind,
    ) ??
    null
  );
}
