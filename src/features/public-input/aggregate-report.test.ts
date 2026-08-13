import { describe, expect, it } from "vitest";

import {
  applySmallCellSuppression,
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

describe("public input aggregate projection", () => {
  it("exposes aggregates only and never forbidden public keys (recursive)", () => {
    const report = publicInputAggregateReports[0];
    expect(report).toBeTruthy();
    const dto = toPublicInputPublicDto(report!);
    expect(dto.participationCount).toBeGreaterThan(0);
    expect(findForbiddenPublicKeys(dto)).toEqual([]);
    expect(dto).not.toHaveProperty("voteRows");
    expect(dto).not.toHaveProperty("xid");
    expect(dto.smallCellSuppressionThreshold).toBe(
      SMALL_CELL_SUPPRESSION_THRESHOLD,
    );
  });

  it("keeps suppressed shares as null with explicit status, never zero", () => {
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
    const { groups, suppressedCells } = applySmallCellSuppression(tiny);
    expect(suppressedCells).toBe(1);
    const suppressed = groups.find((group) => group.label === "Group C");
    expect(suppressed).toEqual({
      label: "Group C",
      status: "suppressed",
      share: null,
    });
    expect(formatOpinionGroupShare(suppressed!)).toBe("Suppressed");
    const zero = groups.find((group) => group.label === "Group Zero");
    expect(zero).toEqual({
      label: "Group Zero",
      status: "reported",
      share: 0,
    });
    expect(formatOpinionGroupShare(zero!)).toBe("0%");
    const dto = toPublicInputPublicDto(tiny);
    expect(dto.opinionGroups.find((g) => g.label === "Group C")).toEqual({
      label: "Group C",
      status: "suppressed",
      share: null,
    });
    expect(dto.opinionGroups.find((g) => g.label === "Group C")?.share).not.toBe(
      0,
    );
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
