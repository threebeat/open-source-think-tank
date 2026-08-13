import { describe, expect, it } from "vitest";

import {
  PUBLIC_INPUT_RECOVERY_TRANSITIONS,
  PUBLIC_INPUT_TRANSITIONS,
  allowedPublicInputActions,
  allowedRecoveryTargets,
  findForwardTransitionRule,
  findRecoveryTransitionRule,
  isSubstantiveReason,
} from "@/lib/public-input/lifecycle/transitions";

describe("Public Input lifecycle transitions (4.3)", () => {
  it("defines the ordinary forward pipeline draft -> ... -> closed", () => {
    expect(findForwardTransitionRule("mark_ready", "draft")?.to).toBe("ready");
    expect(findForwardTransitionRule("open", "ready")?.to).toBe("open");
    expect(findForwardTransitionRule("close_commenting", "open")?.to).toBe(
      "commenting_closed",
    );
    expect(
      findForwardTransitionRule("close_voting", "commenting_closed")?.to,
    ).toBe("voting_closed");
    expect(findForwardTransitionRule("close", "voting_closed")?.to).toBe(
      "closed",
    );
  });

  it("rejects unlisted forward transitions", () => {
    expect(findForwardTransitionRule("open", "draft")).toBeNull();
    expect(findForwardTransitionRule("close", "open")).toBeNull();
    expect(findForwardTransitionRule("mark_ready", "archived")).toBeNull();
  });

  it("allows archive from any non-archived, non-draft-only state with a reason", () => {
    for (const from of [
      "draft",
      "ready",
      "open",
      "commenting_closed",
      "voting_closed",
      "closed",
    ] as const) {
      const rule = findForwardTransitionRule("archive", from);
      expect(rule?.to).toBe("archived");
      expect(rule?.reasonRequired).toBe(true);
    }
  });

  it("requires a reason only for close and archive in the forward pipeline", () => {
    expect(PUBLIC_INPUT_TRANSITIONS.mark_ready[0]?.reasonRequired).toBe(false);
    expect(PUBLIC_INPUT_TRANSITIONS.open[0]?.reasonRequired).toBe(false);
    expect(PUBLIC_INPUT_TRANSITIONS.close_commenting[0]?.reasonRequired).toBe(
      false,
    );
    expect(PUBLIC_INPUT_TRANSITIONS.close_voting[0]?.reasonRequired).toBe(
      false,
    );
    expect(PUBLIC_INPUT_TRANSITIONS.close[0]?.reasonRequired).toBe(true);
    for (const rule of PUBLIC_INPUT_TRANSITIONS.archive) {
      expect(rule.reasonRequired).toBe(true);
    }
  });

  it("every forward and recovery rule requires consultations.transition", () => {
    for (const rules of Object.values(PUBLIC_INPUT_TRANSITIONS)) {
      for (const rule of rules) {
        expect(rule.capability).toBe("consultations.transition");
      }
    }
    for (const rule of PUBLIC_INPUT_RECOVERY_TRANSITIONS) {
      expect(rule.capability).toBe("consultations.transition");
    }
  });

  it("recovery transitions always require a reason and use a distinct audit action", () => {
    for (const rule of PUBLIC_INPUT_RECOVERY_TRANSITIONS) {
      expect(rule.reasonRequired).toBe(true);
      expect(rule.auditAction).toBe("consultations.recovery_transition");
    }
    // Never reuses an ordinary forward-pipeline audit action for a recovery move.
    const forwardAuditActions = new Set(
      Object.values(PUBLIC_INPUT_TRANSITIONS)
        .flat()
        .map((rule) => rule.auditAction),
    );
    expect(forwardAuditActions.has("consultations.recovery_transition")).toBe(
      false,
    );
  });

  it("finds a specific recovery rule by from/to and rejects an unlisted pair", () => {
    expect(findRecoveryTransitionRule("open", "ready")?.reasonRequired).toBe(
      true,
    );
    expect(findRecoveryTransitionRule("draft", "closed")).toBeNull();
    expect(findRecoveryTransitionRule("archived", "closed")).toBeNull();
  });

  it("isSubstantiveReason enforces a minimum length and rejects blank/whitespace", () => {
    expect(isSubstantiveReason(undefined)).toBe(false);
    expect(isSubstantiveReason(null)).toBe(false);
    expect(isSubstantiveReason("")).toBe(false);
    expect(isSubstantiveReason("short")).toBe(false);
    expect(isSubstantiveReason("        ")).toBe(false);
    expect(isSubstantiveReason("This is a substantive reason.")).toBe(true);
  });

  it("allowedPublicInputActions / allowedRecoveryTargets are UI hints only, matching the rule tables", () => {
    expect(allowedPublicInputActions("draft").sort()).toEqual(
      ["archive", "mark_ready"].sort(),
    );
    expect(allowedPublicInputActions("archived")).toEqual([]);
    expect(allowedRecoveryTargets("open")).toEqual(["ready"]);
    expect(allowedRecoveryTargets("draft")).toEqual([]);
  });
});
