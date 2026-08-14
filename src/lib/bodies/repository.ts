import { and, asc, desc, eq } from "drizzle-orm";

import {
  appointmentConflictsAndRecusals,
  chamberRollCalls,
  chamberSessions,
  chamberVerdictVersions,
  councilRecommendationVersions,
  councilRollCalls,
  councilSessions,
  organizationAppointments,
  profiles,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { RollCallPosition } from "@/lib/governance/contract";
import { requireOrganizationId } from "@/lib/organizations/ids";
import type { OrganizationAppointmentKind } from "@/lib/organizations/types";

export type SessionRow = {
  id: string;
  organizationId: string;
  publicId: string;
  topicGovernanceRecordId: string;
  status: string;
  timezone: string;
  scheduledOpensAt: Date;
  scheduledClosesAt: Date;
  intakeReason?: string | null;
  synthetic: boolean;
};

export type VerdictRow = {
  id: string;
  organizationId: string;
  sessionId: string;
  topicGovernanceRecordId: string;
  version: number;
  outcome: "accepted" | "disputed";
  rationale: string;
  minorityReasoning: string | null;
  publishedAt: Date;
  rosterSnapshot: Array<{ memberPublicId: string; appointmentKind: string }>;
  synthetic: boolean;
};

export type RecommendationRow = {
  id: string;
  organizationId: string;
  sessionId: string;
  topicGovernanceRecordId: string;
  version: number;
  rationale: string;
  minorityReasoning: string | null;
  publishedAt: Date;
  rosterSnapshot: Array<{ memberPublicId: string; appointmentKind: string }>;
  synthetic: boolean;
};

export type RollCallRow = {
  id: string;
  organizationId: string;
  sessionId: string;
  versionId: string;
  appointmentId: string;
  memberPublicId: string;
  position: RollCallPosition;
  recordedAt: Date;
  synthetic: boolean;
};

export type SeatDisplay = {
  appointmentId: string;
  accountId: string;
  appointmentKind: OrganizationAppointmentKind;
  displayName: string;
  termStartsAt: Date;
  termEndsAt: Date | null;
};

export async function getChamberSessionForTopic(
  db: FoundationDb,
  organizationId: string,
  recordId: string,
): Promise<SessionRow | null> {
  const id = requireOrganizationId(organizationId);
  const [row] = await db
    .select()
    .from(chamberSessions)
    .where(
      and(
        eq(chamberSessions.organizationId, id),
        eq(chamberSessions.topicGovernanceRecordId, recordId),
      ),
    )
    .limit(1);
  return row ? mapSession(row) : null;
}

export async function getCouncilSessionForTopic(
  db: FoundationDb,
  organizationId: string,
  recordId: string,
): Promise<SessionRow | null> {
  const id = requireOrganizationId(organizationId);
  const [row] = await db
    .select()
    .from(councilSessions)
    .where(
      and(
        eq(councilSessions.organizationId, id),
        eq(councilSessions.topicGovernanceRecordId, recordId),
      ),
    )
    .limit(1);
  return row
    ? {
        ...mapSession(row),
        intakeReason: row.intakeReason,
      }
    : null;
}

export async function insertChamberSession(
  db: FoundationDb,
  input: {
    id: string;
    organizationId: string;
    publicId: string;
    recordId: string;
    status: "scheduled" | "in_session" | "closed";
    timezone: string;
    scheduledOpensAt: Date;
    scheduledClosesAt: Date;
    synthetic: boolean;
  },
): Promise<void> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db.insert(chamberSessions).values({
    id: input.id,
    organizationId,
    publicId: input.publicId,
    topicGovernanceRecordId: input.recordId,
    status: input.status,
    timezone: input.timezone,
    scheduledOpensAt: input.scheduledOpensAt,
    scheduledClosesAt: input.scheduledClosesAt,
    synthetic: input.synthetic,
  });
}

export async function updateChamberSessionStatus(
  db: FoundationDb,
  input: {
    organizationId: string;
    sessionId: string;
    status: "scheduled" | "in_session" | "closed";
  },
): Promise<void> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db
    .update(chamberSessions)
    .set({ status: input.status, updatedAt: new Date() })
    .where(
      and(
        eq(chamberSessions.organizationId, organizationId),
        eq(chamberSessions.id, input.sessionId),
      ),
    );
}

export async function insertCouncilSession(
  db: FoundationDb,
  input: {
    id: string;
    organizationId: string;
    publicId: string;
    recordId: string;
    status: "scheduled" | "in_session" | "closed";
    timezone: string;
    scheduledOpensAt: Date;
    scheduledClosesAt: Date;
    intakeReason?: string | null;
    synthetic: boolean;
  },
): Promise<void> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db.insert(councilSessions).values({
    id: input.id,
    organizationId,
    publicId: input.publicId,
    topicGovernanceRecordId: input.recordId,
    status: input.status,
    timezone: input.timezone,
    scheduledOpensAt: input.scheduledOpensAt,
    scheduledClosesAt: input.scheduledClosesAt,
    intakeReason: input.intakeReason ?? null,
    synthetic: input.synthetic,
  });
}

export async function updateCouncilSessionStatus(
  db: FoundationDb,
  input: {
    organizationId: string;
    sessionId: string;
    status: "scheduled" | "in_session" | "closed";
    intakeReason?: string | null;
  },
): Promise<void> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db
    .update(councilSessions)
    .set({
      status: input.status,
      updatedAt: new Date(),
      ...(input.intakeReason !== undefined
        ? { intakeReason: input.intakeReason }
        : {}),
    })
    .where(
      and(
        eq(councilSessions.organizationId, organizationId),
        eq(councilSessions.id, input.sessionId),
      ),
    );
}

export async function insertChamberVerdict(
  db: FoundationDb,
  input: VerdictRow,
): Promise<void> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db.insert(chamberVerdictVersions).values({
    id: input.id,
    organizationId,
    sessionId: input.sessionId,
    topicGovernanceRecordId: input.topicGovernanceRecordId,
    version: input.version,
    outcome: input.outcome,
    rationale: input.rationale,
    minorityReasoning: input.minorityReasoning,
    publishedAt: input.publishedAt,
    rosterSnapshot: input.rosterSnapshot,
    synthetic: input.synthetic,
  });
}

export async function insertCouncilRecommendation(
  db: FoundationDb,
  input: RecommendationRow,
): Promise<void> {
  const organizationId = requireOrganizationId(input.organizationId);
  await db.insert(councilRecommendationVersions).values({
    id: input.id,
    organizationId,
    sessionId: input.sessionId,
    topicGovernanceRecordId: input.topicGovernanceRecordId,
    version: input.version,
    rationale: input.rationale,
    minorityReasoning: input.minorityReasoning,
    publishedAt: input.publishedAt,
    rosterSnapshot: input.rosterSnapshot,
    synthetic: input.synthetic,
  });
}

export async function insertChamberRollCalls(
  db: FoundationDb,
  rows: Array<{
    id: string;
    organizationId: string;
    sessionId: string;
    verdictVersionId: string;
    appointmentId: string;
    memberPublicId: string;
    position: RollCallPosition;
    recordedAt: Date;
    synthetic: boolean;
  }>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  await db.insert(chamberRollCalls).values(
    rows.map((row) => ({
      ...row,
      organizationId: requireOrganizationId(row.organizationId),
    })),
  );
}

export async function insertCouncilRollCalls(
  db: FoundationDb,
  rows: Array<{
    id: string;
    organizationId: string;
    sessionId: string;
    recommendationVersionId: string;
    appointmentId: string;
    memberPublicId: string;
    position: RollCallPosition;
    recordedAt: Date;
    synthetic: boolean;
  }>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  await db.insert(councilRollCalls).values(
    rows.map((row) => ({
      ...row,
      organizationId: requireOrganizationId(row.organizationId),
    })),
  );
}

export async function getLatestChamberVerdict(
  db: FoundationDb,
  organizationId: string,
  sessionId: string,
): Promise<VerdictRow | null> {
  const id = requireOrganizationId(organizationId);
  const [row] = await db
    .select()
    .from(chamberVerdictVersions)
    .where(
      and(
        eq(chamberVerdictVersions.organizationId, id),
        eq(chamberVerdictVersions.sessionId, sessionId),
      ),
    )
    .orderBy(desc(chamberVerdictVersions.version))
    .limit(1);
  return row ? mapVerdict(row) : null;
}

export async function getLatestCouncilRecommendation(
  db: FoundationDb,
  organizationId: string,
  sessionId: string,
): Promise<RecommendationRow | null> {
  const id = requireOrganizationId(organizationId);
  const [row] = await db
    .select()
    .from(councilRecommendationVersions)
    .where(
      and(
        eq(councilRecommendationVersions.organizationId, id),
        eq(councilRecommendationVersions.sessionId, sessionId),
      ),
    )
    .orderBy(desc(councilRecommendationVersions.version))
    .limit(1);
  return row ? mapRecommendation(row) : null;
}

export async function listChamberRollCalls(
  db: FoundationDb,
  organizationId: string,
  verdictVersionId: string,
): Promise<RollCallRow[]> {
  const id = requireOrganizationId(organizationId);
  const rows = await db
    .select()
    .from(chamberRollCalls)
    .where(
      and(
        eq(chamberRollCalls.organizationId, id),
        eq(chamberRollCalls.verdictVersionId, verdictVersionId),
      ),
    )
    .orderBy(asc(chamberRollCalls.memberPublicId));
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    sessionId: row.sessionId,
    versionId: row.verdictVersionId,
    appointmentId: row.appointmentId,
    memberPublicId: row.memberPublicId,
    position: row.position,
    recordedAt: row.recordedAt,
    synthetic: row.synthetic,
  }));
}

export async function listCouncilRollCalls(
  db: FoundationDb,
  organizationId: string,
  recommendationVersionId: string,
): Promise<RollCallRow[]> {
  const id = requireOrganizationId(organizationId);
  const rows = await db
    .select()
    .from(councilRollCalls)
    .where(
      and(
        eq(councilRollCalls.organizationId, id),
        eq(councilRollCalls.recommendationVersionId, recommendationVersionId),
      ),
    )
    .orderBy(asc(councilRollCalls.memberPublicId));
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    sessionId: row.sessionId,
    versionId: row.recommendationVersionId,
    appointmentId: row.appointmentId,
    memberPublicId: row.memberPublicId,
    position: row.position,
    recordedAt: row.recordedAt,
    synthetic: row.synthetic,
  }));
}

export async function listSeatDisplays(
  db: FoundationDb,
  organizationId: string,
  kinds: readonly OrganizationAppointmentKind[],
): Promise<SeatDisplay[]> {
  const id = requireOrganizationId(organizationId);
  const rows = await db
    .select({
      appointmentId: organizationAppointments.id,
      accountId: organizationAppointments.accountId,
      appointmentKind: organizationAppointments.appointmentKind,
      displayName: profiles.preferredDisplayName,
      termStartsAt: organizationAppointments.termStartsAt,
      termEndsAt: organizationAppointments.termEndsAt,
      revokedAt: organizationAppointments.revokedAt,
    })
    .from(organizationAppointments)
    .innerJoin(
      profiles,
      eq(profiles.accountId, organizationAppointments.accountId),
    )
    .where(eq(organizationAppointments.organizationId, id));
  const now = Date.now();
  return rows
    .filter((row) => {
      if (row.revokedAt) {
        return false;
      }
      if (!kinds.includes(row.appointmentKind)) {
        return false;
      }
      if (row.termStartsAt.getTime() > now) {
        return false;
      }
      if (row.termEndsAt && row.termEndsAt.getTime() <= now) {
        return false;
      }
      return true;
    })
    .map((row) => ({
      appointmentId: row.appointmentId,
      accountId: row.accountId,
      appointmentKind: row.appointmentKind,
      displayName: row.displayName,
      termStartsAt: row.termStartsAt,
      termEndsAt: row.termEndsAt,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function listConflictsForRecord(
  db: FoundationDb,
  organizationId: string,
  recordId: string,
): Promise<Array<{ appointmentId: string; kind: string; reason: string }>> {
  const id = requireOrganizationId(organizationId);
  return db
    .select({
      appointmentId: appointmentConflictsAndRecusals.appointmentId,
      kind: appointmentConflictsAndRecusals.kind,
      reason: appointmentConflictsAndRecusals.reason,
    })
    .from(appointmentConflictsAndRecusals)
    .where(
      and(
        eq(appointmentConflictsAndRecusals.organizationId, id),
        eq(appointmentConflictsAndRecusals.topicGovernanceRecordId, recordId),
      ),
    );
}

function mapSession(row: {
  id: string;
  organizationId: string;
  publicId: string;
  topicGovernanceRecordId: string;
  status: string;
  timezone: string;
  scheduledOpensAt: Date;
  scheduledClosesAt: Date;
  synthetic: boolean;
}): SessionRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    publicId: row.publicId,
    topicGovernanceRecordId: row.topicGovernanceRecordId,
    status: row.status,
    timezone: row.timezone,
    scheduledOpensAt: row.scheduledOpensAt,
    scheduledClosesAt: row.scheduledClosesAt,
    synthetic: row.synthetic,
  };
}

function mapVerdict(
  row: typeof chamberVerdictVersions.$inferSelect,
): VerdictRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    sessionId: row.sessionId,
    topicGovernanceRecordId: row.topicGovernanceRecordId,
    version: row.version,
    outcome: row.outcome,
    rationale: row.rationale,
    minorityReasoning: row.minorityReasoning,
    publishedAt: row.publishedAt,
    rosterSnapshot: row.rosterSnapshot,
    synthetic: row.synthetic,
  };
}

function mapRecommendation(
  row: typeof councilRecommendationVersions.$inferSelect,
): RecommendationRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    sessionId: row.sessionId,
    topicGovernanceRecordId: row.topicGovernanceRecordId,
    version: row.version,
    rationale: row.rationale,
    minorityReasoning: row.minorityReasoning,
    publishedAt: row.publishedAt,
    rosterSnapshot: row.rosterSnapshot,
    synthetic: row.synthetic,
  };
}
