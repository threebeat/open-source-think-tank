import type {
  AgendaEvidenceDto,
  AgendaHistoryDto,
  AgendaStatementDto,
  AgendaTopicDetailDto,
  AgendaTopicListItemDto,
  MemberStatementPosition,
} from "@/lib/agenda/types";
import {
  governanceStateMeta,
  type TopicGovernanceState,
} from "@/lib/governance/contract";
import type {
  GovernanceEventRow,
  GovernanceRecordRow,
  SyntheticStatement,
} from "@/lib/governance/repository";
import type { LegacyEvidenceRow } from "@/lib/agenda/repository";

const FORBIDDEN_PUBLIC_KEYS = [
  "xid",
  "XID",
  "providerConversationRef",
  "fixtureConversationId",
  "currentProviderEntityId",
  "accountId",
  "rawVotes",
  "people",
] as const;

export function stateLabel(state: TopicGovernanceState): string {
  const meta = governanceStateMeta(state);
  return meta?.description ?? state;
}

export function toListItemDto(row: GovernanceRecordRow): AgendaTopicListItemDto | null {
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
    synthetic: row.synthetic,
    consultationReportVisible: meta?.consultationReportVisible ?? false,
  };
}

export function statementsToDto(
  statements: SyntheticStatement[] | null,
  viewerPositions: Map<string, MemberStatementPosition>,
): AgendaStatementDto[] {
  return (statements ?? []).map((statement) => ({
    publicId: statement.publicId,
    text: statement.text,
    viewerPosition: viewerPositions.get(statement.publicId) ?? null,
  }));
}

export function syntheticEvidenceToDto(
  copy: GovernanceRecordRow["syntheticEvidence"],
): AgendaEvidenceDto[] {
  if (!copy?.items) {
    return [];
  }
  const rank: Record<string, number> = {
    accepted: 0,
    limited: 1,
    disputed: 2,
    pending: 3,
  };
  return [...copy.items]
    .sort((a, b) => {
      const delta = (rank[a.qualityStatus] ?? 99) - (rank[b.qualityStatus] ?? 99);
      if (delta !== 0) {
        return delta;
      }
      return a.title.localeCompare(b.title);
    })
    .map((item) => ({
      title: item.title,
      summary: item.summary,
      organization: null,
      sourceType: null,
      authorType: null,
      qualityStatus: item.qualityStatus,
      limitations: item.limitations,
      labeledSynthetic: true,
    }));
}

export function legacyEvidenceToDto(rows: LegacyEvidenceRow[]): AgendaEvidenceDto[] {
  return rows.map((row) => ({
    title: row.title,
    summary: null,
    organization: row.organization,
    sourceType: row.sourceType,
    authorType: row.authorType,
    qualityStatus: row.qualityStatus,
    limitations: row.limitations,
    labeledSynthetic: true,
  }));
}

export function historyToDto(events: GovernanceEventRow[]): AgendaHistoryDto[] {
  return events.map((event) => ({
    fromState: event.fromState,
    toState: event.toState,
    action: event.action,
    at: event.at.toISOString(),
    actorPrincipalKind: event.actorPrincipalKind,
    synthetic: event.synthetic,
  }));
}

export function assertPublicAgendaDto(value: unknown): void {
  const json = JSON.stringify(value);
  for (const key of FORBIDDEN_PUBLIC_KEYS) {
    if (json.includes(`"${key}"`)) {
      throw new Error(`AGENDA_PUBLIC_DTO_FORBIDDEN_KEY:${key}`);
    }
  }
  if (/https?:\/\/pol\.is/i.test(json) || /pol\.is\/embed\.js/i.test(json)) {
    throw new Error("AGENDA_PUBLIC_DTO_POLIS_URL");
  }
}

export function toTopicDetailDto(input: {
  row: GovernanceRecordRow;
  statements: AgendaStatementDto[];
  evidence: AgendaEvidenceDto[];
  discussions: AgendaTopicDetailDto["discussions"];
  history: AgendaHistoryDto[];
  canRecordPosition: boolean;
}): AgendaTopicDetailDto {
  const meta = governanceStateMeta(input.row.state);
  if (!input.row.slug || !input.row.title) {
    throw new Error("AGENDA_TOPIC_MISSING_CATALOG");
  }
  const dto: AgendaTopicDetailDto = {
    publicId: input.row.publicId,
    slug: input.row.slug,
    title: input.row.title,
    question: input.row.question,
    overview: input.row.overview,
    state: input.row.state,
    stateLabel: stateLabel(input.row.state),
    realm: meta?.realm ?? "public_agenda",
    synthetic: input.row.synthetic,
    consultationReportVisible: meta?.consultationReportVisible ?? false,
    canRecordPosition: input.canRecordPosition,
    hostedPolisEnabled: false,
    fixtureProviderKind: input.row.fixtureConversationId ? "fixture" : "none",
    consultationClosed: input.row.state !== "qualified_consultation",
    statements: input.statements,
    evidence: input.evidence,
    discussions: input.discussions,
    history: input.history,
  };
  assertPublicAgendaDto(dto);
  return dto;
}
