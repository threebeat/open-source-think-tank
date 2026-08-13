import { describe, expect, it } from "vitest";

import { findForbiddenPublicKeys } from "@/features/public-input/aggregate-report";
import { mapPublicReportDtoToPanelDto } from "@/features/public-input/map-public-report";
import type { PublicReportDto } from "@/lib/public-input/reports/projection";

function sampleReport(): PublicReportDto {
  return {
    synthetic: false,
    topicId: "topic-1",
    reportVersion: 2,
    publicTitle: "Published aggregate",
    publishedAt: "2026-08-13T12:00:00.000Z",
    participationCount: 200,
    commentTotal: 20,
    voteTotal: 1000,
    opinionGroups: [
      { label: "Group A", status: "reported", share: 0.7 },
      { label: "Group B", status: "suppressed", share: null },
    ],
    crossGroupAgreement: ["Shared statement"],
    meaningfulDisagreement: ["Disagreement statement"],
    participationSufficiency: "Sufficient for illustration.",
    representationLimitations: "Not representative.",
    methodVersion: "public-input-aggregate@4.4.0",
    importTimestamp: "2026-08-13T11:00:00.000Z",
    smallCellSuppressionPolicyVersion: "4.4.1-complementary",
    smallCellSuppressionNotice: "Complementary suppression applied.",
    suppressedCells: 1,
    groupsOmitted: false,
    moderationDisclosure: {
      reviewedCount: 10,
      acceptedCount: 8,
      rejectedCount: 2,
      policyVersion: "mod-policy@1",
    },
    providerNotice: "Aggregate-only Public Input report.",
    isSuperseded: false,
  };
}

describe("mapPublicReportDtoToPanelDto", () => {
  it("maps allowlisted fields without reintroducing protected keys", () => {
    const dto = mapPublicReportDtoToPanelDto(sampleReport(), "example-slug");
    expect(dto.synthetic).toBe(false);
    expect(dto.topicSlug).toBe("example-slug");
    expect(dto.reportVersion).toBe(2);
    expect(dto.opinionGroups[1]).toEqual({
      label: "Group B",
      status: "suppressed",
      share: null,
    });
    expect(dto.moderationDisclosure?.reviewedCount).toBe(10);
    expect(findForbiddenPublicKeys(dto)).toEqual([]);
    expect(JSON.stringify(dto)).not.toContain("topicId");
    expect(JSON.stringify(dto)).not.toContain("conversationId");
  });
});
