/**
 * Seed/playback-only fixture consultation close.
 *
 * trustedSystem: true is set here and nowhere else. HTTP handlers and
 * client components must not import this module.
 */
import type { AdapterResult } from "@/lib/adapters/types";
import { transitionGovernanceRecord } from "@/lib/governance/service";
import { getGovernanceRecord } from "@/lib/governance/repository";
import type { FoundationDb } from "@/db/types";
import { requireOrganizationId } from "@/lib/organizations/ids";

export const FIXTURE_CLOSE_ACTIONS = [
  "close_as_accepted",
  "close_as_disputed",
  "close_as_inconclusive",
] as const;

export type FixtureCloseAction = (typeof FIXTURE_CLOSE_ACTIONS)[number];

export type SyntheticMetricsSnapshot = {
  labeledSynthetic: true;
  openDecision: "V2-07";
  ruleVersion: "synthetic-fixture";
  outcome: "community_accepted" | "community_disputed" | "consultation_inconclusive";
  participationCount: number;
  note: string;
};

const ACTION_OUTCOME: Record<
  FixtureCloseAction,
  SyntheticMetricsSnapshot["outcome"]
> = {
  close_as_accepted: "community_accepted",
  close_as_disputed: "community_disputed",
  close_as_inconclusive: "consultation_inconclusive",
};

export function syntheticMetricsSnapshot(
  action: FixtureCloseAction,
  participationCount: number,
): SyntheticMetricsSnapshot {
  return {
    labeledSynthetic: true,
    openDecision: "V2-07",
    ruleVersion: "synthetic-fixture",
    outcome: ACTION_OUTCOME[action],
    participationCount,
    note: "Fixture playback only. Not a production consultation threshold.",
  };
}

/**
 * Close a seeded synthetic topic using the governance kernel.
 * Members and browser handlers cannot invoke the system actor.
 */
export async function playFixtureConsultationClose(
  db: FoundationDb,
  input: {
    organizationId: string;
    recordId: string;
    action: FixtureCloseAction;
    participationCount?: number;
  },
): Promise<AdapterResult<{ to: string }>> {
  const organizationId = requireOrganizationId(input.organizationId);
  const record = await getGovernanceRecord(db, organizationId, input.recordId);
  if (!record) {
    return {
      ok: false,
      code: "GOVERNANCE_RECORD_NOT_FOUND",
      error: "Governance record not found in this organization",
    };
  }
  if (!record.synthetic) {
    return {
      ok: false,
      code: "AGENDA_PLAYBACK_NOT_SYNTHETIC",
      error: "Fixture close playback is limited to synthetic seeded topics",
    };
  }
  if (record.state !== "qualified_consultation") {
    return {
      ok: false,
      code: "GOVERNANCE_ILLEGAL_TRANSITION",
      error: `Fixture close requires qualified_consultation (found ${record.state})`,
    };
  }

  return transitionGovernanceRecord(db, {
    principal: null,
    organizationId,
    recordId: record.id,
    action: input.action,
    actor: "system_from_published_rule",
    metricsSnapshot: syntheticMetricsSnapshot(
      input.action,
      input.participationCount ?? 12,
    ),
    synthetic: true,
    trustedSystem: true,
  });
}
