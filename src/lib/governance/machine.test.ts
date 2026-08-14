import { describe, expect, it } from "vitest";

import {
  GOVERNANCE_ACTIONS,
  GOVERNANCE_CONTRACT,
  GOVERNANCE_STATES,
  GOVERNANCE_TRANSITIONS,
  PUBLIC_AGENDA_STATES,
  isPublicAgendaState,
} from "@/lib/governance/contract";
import { evaluateTransition } from "@/lib/governance/machine";
import type { GovernanceActor } from "@/lib/governance/contract";

describe("governance contract TypeScript mirror", () => {
  it("matches the executable JSON state and action sets", () => {
    expect(GOVERNANCE_CONTRACT.schemaVersion).toBe(
      "commonhall-governance@2.0.0",
    );
    expect([...GOVERNANCE_STATES].sort()).toEqual(
      GOVERNANCE_CONTRACT.states.map((state) => state.id).sort(),
    );
    expect([...GOVERNANCE_ACTIONS].sort()).toEqual(
      [
        ...new Set(GOVERNANCE_CONTRACT.transitions.map((row) => row.action)),
      ].sort(),
    );
    expect(GOVERNANCE_STATES).toHaveLength(16);
  });
});

describe("governance transition engine", () => {
  it("accepts every JSON transition when required fields are present", () => {
    for (const transition of GOVERNANCE_TRANSITIONS) {
      const result = evaluateTransition({
        from: transition.from,
        action: transition.action,
        actor: transition.actor,
        reason: transition.reasonRequired ? "synthetic-reason" : null,
        criteriaTrace: transition.criteriaTraceRequired
          ? { criterion: "completeness", result: "met" }
          : null,
        metricsSnapshot: transition.metricsSnapshotRequired
          ? { participationCount: 0, ruleVersion: "synthetic" }
          : null,
        verdict: transition.verdictRequired
          ? { version: 1, outcome: "accepted" }
          : null,
      });
      expect(result.ok, transition.action).toBe(true);
      if (result.ok) {
        expect(result.value.to).toBe(transition.to);
      }
    }
  });

  it("denies informal/formal shortcuts to Chamber or Council", () => {
    for (const from of ["informal_draft", "formal_review_pending"] as const) {
      for (const action of [
        "queue_for_chamber",
        "start_chamber_deliberation",
        "accept_to_council_agenda",
      ] as const) {
        const result = evaluateTransition({
          from,
          action,
          actor: "system_from_published_rule",
        });
        expect(result.ok).toBe(false);
      }
    }
  });

  it("only queues Chamber from community_accepted", () => {
    const accepted = evaluateTransition({
      from: "community_accepted",
      action: "queue_for_chamber",
      actor: "system_from_published_rule",
    });
    expect(accepted.ok).toBe(true);

    const disputed = evaluateTransition({
      from: "community_disputed",
      action: "queue_for_chamber",
      actor: "system_from_published_rule",
    });
    expect(disputed.ok).toBe(false);
  });

  it("marks consultation states as Public Agenda and not informal drafts", () => {
    expect(PUBLIC_AGENDA_STATES).toContain("qualified_consultation");
    expect(PUBLIC_AGENDA_STATES).toContain("community_accepted");
    expect(PUBLIC_AGENDA_STATES).toContain("community_disputed");
    expect(PUBLIC_AGENDA_STATES).toContain("consultation_inconclusive");
    expect(PUBLIC_AGENDA_STATES).not.toContain("informal_draft");
    expect(PUBLIC_AGENDA_STATES).not.toContain("formal_review_pending");
    expect(PUBLIC_AGENDA_STATES).toContain("chamber_queued");
    expect(PUBLIC_AGENDA_STATES).toContain("chamber_accepted");
    expect(PUBLIC_AGENDA_STATES).toContain("council_declined");
    expect(PUBLIC_AGENDA_STATES).not.toContain("council_scheduled");
    expect(PUBLIC_AGENDA_STATES).not.toContain("recommendations_published");
    expect(isPublicAgendaState("chamber_accepted")).toBe(true);
    expect(isPublicAgendaState("council_scheduled")).toBe(false);
  });

  it("denies missing reason, criteria, metrics, verdict, and wrong actor", () => {
    expect(
      evaluateTransition({
        from: "formal_review_pending",
        action: "return_for_revision",
        actor: "moderator",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "formal_review_pending",
        action: "qualify",
        actor: "moderator",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "qualified_consultation",
        action: "close_as_accepted",
        actor: "system_from_published_rule",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "chamber_deliberating",
        action: "record_chamber_acceptance",
        actor: "chamber",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "chamber_accepted",
        action: "decline_council_intake",
        actor: "council",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "chamber_accepted",
        action: "decline_council_intake",
        actor: "council",
        reason: "synthetic-override-reason",
      }).ok,
    ).toBe(true);
    expect(
      evaluateTransition({
        from: "chamber_disputed",
        action: "accept_disputed_to_council_agenda",
        actor: "council",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "chamber_disputed",
        action: "accept_disputed_to_council_agenda",
        actor: "council",
        reason: "synthetic-override-reason",
      }).ok,
    ).toBe(true);
    expect(
      evaluateTransition({
        from: "chamber_accepted",
        action: "accept_to_council_agenda",
        actor: "council",
      }).ok,
    ).toBe(true);
    expect(
      evaluateTransition({
        from: "formal_review_pending",
        action: "qualify",
        actor: "community_member" as GovernanceActor,
        criteriaTrace: { criterion: "completeness", result: "met" },
      }).ok,
    ).toBe(false);
  });

  it("denies unknown states/actions and terminal outgoing transitions", () => {
    expect(
      evaluateTransition({
        from: "not_a_state",
        action: "qualify",
        actor: "moderator",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "informal_draft",
        action: "not_an_action",
        actor: "community_member",
      }).ok,
    ).toBe(false);
    expect(
      evaluateTransition({
        from: "recommendations_published",
        action: "qualify",
        actor: "moderator",
      }).ok,
    ).toBe(false);
  });
});
