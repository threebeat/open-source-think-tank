import { describe, expect, it } from "vitest";

import {
  assertNoForbiddenPublicKeys,
  getPublicInputPublicDto,
  toPublicInputPublicDto,
} from "@/features/public-input/aggregate-report";
import {
  SMALL_CELL_SUPPRESSION_THRESHOLD,
  publicInputAggregateReports,
} from "@/fixtures/journey-catalog";

describe("public input aggregate projection", () => {
  it("exposes aggregates only and never forbidden public keys", () => {
    const report = publicInputAggregateReports[0];
    expect(report).toBeTruthy();
    const dto = toPublicInputPublicDto(report!);
    expect(dto.participationCount).toBeGreaterThan(0);
    expect(dto.opinionGroups.every((group) => /^Group /.test(group.label))).toBe(
      true,
    );
    expect(assertNoForbiddenPublicKeys(dto)).toEqual([]);
    expect(dto).not.toHaveProperty("voteRows");
    expect(dto).not.toHaveProperty("xid");
    expect(dto).not.toHaveProperty("accountId");
    expect(dto.smallCellSuppressionThreshold).toBe(
      SMALL_CELL_SUPPRESSION_THRESHOLD,
    );
  });

  it("loads the Cedar River public DTO", () => {
    const dto = getPublicInputPublicDto("cedar-river-drought-surcharge");
    expect(dto?.synthetic).toBe(true);
    expect(dto?.providerNotice).toMatch(/not a decision-maker/i);
  });
});
