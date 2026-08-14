import { describe, expect, it } from "vitest";

import {
  applyComplementarySuppressionToReport,
  findForbiddenPublicKeys,
  formatOpinionGroupShare,
  getPublicInputPublicDto,
  toPublicInputPublicDto,
} from "@/features/public-input/aggregate-report";
import {
  SMALL_CELL_SUPPRESSION_THRESHOLD,
  publicInputAggregateReports,
  type PublicInputAggregateReport,
} from "@/fixtures/journey-catalog";
import { SMALL_CELL_POLICY_VERSION } from "@/lib/public-input/reports/suppression";

describe("public input aggregate projection", () => {
  it("exposes aggregates only and never forbidden public keys (recursive)", () => {
    const report = publicInputAggregateReports[0];
    expect(report).toBeTruthy();
    const dto = toPublicInputPublicDto(report!);
    expect(dto.synthetic).toBe(true);
    expect(dto.participationCount).toBeGreaterThan(0);
    expect(findForbiddenPublicKeys(dto)).toEqual([]);
    expect(dto).not.toHaveProperty("voteRows");
    expect(dto).not.toHaveProperty("xid");
    expect(dto.smallCellSuppressionThreshold).toBe(
      SMALL_CELL_SUPPRESSION_THRESHOLD,
    );
    expect(dto.smallCellSuppressionPolicyVersion).toBe(
      SMALL_CELL_POLICY_VERSION,
    );
  });

  it("keeps a genuine zero share reported as 0, never suppressed", () => {
    const tiny: PublicInputAggregateReport = {
      ...publicInputAggregateReports[0]!,
      participationCount: 100,
      opinionGroups: [
        { label: "Group A", share: 0.5 },
        { label: "Group B", share: 0.47 },
        { label: "Group C", share: 0.03 }, // implied 3 < 5
        { label: "Group Zero", share: 0 },
      ],
    };
    const { groups } = applyComplementarySuppressionToReport(tiny);
    const zero = groups.find((group) => group.label === "Group Zero");
    expect(zero).toEqual({
      label: "Group Zero",
      status: "reported",
      share: 0,
    });
    expect(formatOpinionGroupShare(zero!)).toBe("0%");
  });

  it("applies complementary suppression when exactly one cell would otherwise be reconstructible", () => {
    const tiny: PublicInputAggregateReport = {
      ...publicInputAggregateReports[0]!,
      participationCount: 100,
      opinionGroups: [
        { label: "Group A", share: 0.5 },
        { label: "Group B", share: 0.47 },
        { label: "Group C", share: 0.03 }, // implied 3 < 5 — lone suppression
        { label: "Group Zero", share: 0 },
      ],
    };
    const { groups, suppressedCells } =
      applyComplementarySuppressionToReport(tiny);
    // C is suppressed directly; without a second suppression, C would be
    // reconstructible as `1 − (A + B + 0)`. B is the smallest positive
    // remaining reported share, so it becomes the complementary victim.
    expect(suppressedCells).toBe(2);
    const suppressedLabels = groups
      .filter((group) => group.status === "suppressed")
      .map((group) => group.label)
      .sort();
    expect(suppressedLabels).toEqual(["Group B", "Group C"]);

    const suppressedC = groups.find((group) => group.label === "Group C");
    expect(suppressedC).toEqual({
      label: "Group C",
      status: "suppressed",
      share: null,
    });
    expect(formatOpinionGroupShare(suppressedC!)).toBe("Suppressed");
    expect(suppressedC!.share).not.toBe(0);

    const stillReported = groups.filter(
      (group) => group.status === "reported",
    );
    expect(stillReported.map((g) => g.label).sort()).toEqual([
      "Group A",
      "Group Zero",
    ]);

    const dto = toPublicInputPublicDto(tiny);
    expect(dto.opinionGroups.find((g) => g.label === "Group C")).toEqual({
      label: "Group C",
      status: "suppressed",
      share: null,
    });
  });

  it("blocks a subtraction/reconstruction attack: total minus reported never recovers a lone suppressed share", () => {
    const scenario: PublicInputAggregateReport = {
      ...publicInputAggregateReports[0]!,
      participationCount: 1000,
      opinionGroups: [
        { label: "Group A", share: 0.6 },
        { label: "Group B", share: 0.396 },
        { label: "Group C", share: 0.004 }, // implied 4 < 5 — the target cell
      ],
    };
    const { groups } = applyComplementarySuppressionToReport(scenario);
    const reportedSum = groups
      .filter((group): group is { label: string; status: "reported"; share: number } =>
        group.status === "reported",
      )
      .reduce((sum, group) => sum + group.share, 0);
    // If only C were suppressed, `1 − reportedSum` would equal C's share
    // almost exactly. Complementary suppression must ensure this is no
    // longer the case because at least two cells are withheld.
    const suppressedCount = groups.filter(
      (group) => group.status === "suppressed",
    ).length;
    expect(suppressedCount).toBeGreaterThanOrEqual(2);
    expect(reportedSum).toBeLessThan(0.6 + 0.396 + 0.004 - 0.001);
  });

  it("omits all group shares when participation is below the group-reporting floor", () => {
    const belowFloor: PublicInputAggregateReport = {
      ...publicInputAggregateReports[0]!,
      participationCount: 3,
      smallCellSuppressionThreshold: 5,
      opinionGroups: [
        { label: "Group A", share: 0.6 },
        { label: "Group B", share: 0.4 },
      ],
    };
    const { groups, suppressedCells, groupsOmitted } =
      applyComplementarySuppressionToReport(belowFloor);
    expect(groupsOmitted).toBe(true);
    expect(groups).toEqual([]);
    expect(suppressedCells).toBe(0);

    const dto = toPublicInputPublicDto(belowFloor);
    expect(dto.groupsOmitted).toBe(true);
    expect(dto.opinionGroups).toEqual([]);
  });

  it("handles rounding at the suppression boundary without leaking exact implied counts", () => {
    const boundary: PublicInputAggregateReport = {
      ...publicInputAggregateReports[0]!,
      participationCount: 1000,
      opinionGroups: [
        { label: "Group A", share: 0.9949 }, // implied 995 -> rounds to 995 (reported)
        { label: "Group B", share: 0.0049 }, // implied 4.9 -> rounds to 5 (threshold, not < 5, reported)
        { label: "Group C", share: 0.0002 }, // implied 0.2 -> rounds to 0 (genuine-zero-ish, stays reported)
      ],
    };
    const { groups } = applyComplementarySuppressionToReport(boundary);
    expect(groups.every((group) => group.status === "reported")).toBe(true);
  });

  it("detects nested forbidden keys in sentinel objects", () => {
    const sentinel = {
      synthetic: true,
      nested: {
        participants: [
          {
            display: "ok",
            providerParticipantId: "prov-1",
            votes: { xid: "link-1", voteMatrix: [[1]] },
          },
        ],
        secrets: { accessToken: "tok", rawProviderUrl: "https://x/?token=1" },
      },
    };
    const hits = findForbiddenPublicKeys(sentinel);
    expect(hits).toEqual(
      expect.arrayContaining([
        "nested.participants.0.providerParticipantId",
        "nested.participants.0.votes.xid",
        "nested.participants.0.votes.voteMatrix",
        "nested.secrets.accessToken",
        "nested.secrets.rawProviderUrl",
      ]),
    );
  });

  it("loads the Cedar River public DTO with suppression-aware groups", () => {
    const dto = getPublicInputPublicDto("cedar-river-drought-surcharge");
    expect(dto?.synthetic).toBe(true);
    expect(dto?.providerNotice).toMatch(/not a decision-maker/i);
    expect(dto?.opinionGroups.some((g) => g.status === "suppressed")).toBe(true);
    expect(dto?.cellPolicy.neverPublic).toContain("xid");
  });
});
