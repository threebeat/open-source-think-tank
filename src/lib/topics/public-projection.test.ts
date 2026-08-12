import { describe, expect, it } from "vitest";

import {
  buildPublicTopicProjection,
  projectionContainsForbiddenKeys,
  type BuildPublicTopicProjectionInput,
} from "@/lib/topics/public-projection";

function baseInput(
  overrides: Partial<BuildPublicTopicProjectionInput> = {},
): BuildPublicTopicProjectionInput {
  return {
    topic: {
      id: "topic-1",
      slug: "alpha-topic",
      title: "Alpha topic",
      question: "What should happen?",
      background: "Background",
      scope: "Scope",
      workflowState: "under_review",
      publicationStatus: "published",
      jurisdictionLevel: "statewide",
      stateCode: "TN",
      countyFips: null,
      publishedAt: new Date("2026-08-11T12:00:00.000Z"),
    },
    claims: [
      {
        id: "claim-1",
        title: "Accepted claim",
        summary: "Summary",
        approachLabel: "Approach",
        workflowState: "accepted",
        moderationVisibility: "visible",
        workflowPublicRationale: "Accepted after review of limitations.",
        conflictPublicSummary: "No known conflict of interest to disclose.",
        revisionSummary: null,
      },
    ],
    evidence: [
      {
        id: "ev-db-1",
        sourceUrl: "https://example.ostt.synth.test/memo",
        title: "Memo",
        organization: "Desk",
        authorType: "agency",
        sourceType: "memo",
        limitations: "Synthetic only",
        workflowState: "accepted",
        qualityStatus: "limited",
        moderationVisibility: "visible",
        qualityPublicRationale: "Useful but limited for recommendation.",
        workflowPublicRationale: "Workflow accepted after review.",
        revisionSummary: null,
      },
    ],
    links: [
      {
        topicId: "topic-1",
        claimId: "claim-1",
        evidenceSubmissionId: "ev-db-1",
        relationship: "supporting",
      },
    ],
    ...overrides,
  };
}

describe("buildPublicTopicProjection", () => {
  it("returns allowlisted DTO for publishable content", () => {
    const projection = buildPublicTopicProjection(baseInput());
    expect(projection).not.toBeNull();
    expect(projection!.slug).toBe("alpha-topic");
    expect(projection!.claims).toHaveLength(1);
    expect(projection!.evidence).toHaveLength(1);
    expect(projection!.evidence[0]!.key).toBe("ev-1");
    expect(projection!.claims[0]!.evidenceLinks[0]!.evidenceKey).toBe("ev-1");
    expect(projectionContainsForbiddenKeys(projection)).toEqual([]);
    expect(JSON.stringify(projection)).not.toContain("ev-db-1");
    expect(JSON.stringify(projection)).not.toContain("private");
  });

  it("returns null for unpublished topics", () => {
    expect(
      buildPublicTopicProjection(
        baseInput({
          topic: {
            ...baseInput().topic,
            publicationStatus: "unpublished",
          },
        }),
      ),
    ).toBeNull();
  });

  it("omits rejected/held rows and requires coherent claim+evidence", () => {
    const projection = buildPublicTopicProjection(
      baseInput({
        claims: [
          {
            id: "claim-rejected",
            title: "Rejected",
            summary: "x",
            approachLabel: "a",
            workflowState: "rejected",
            moderationVisibility: "visible",
            workflowPublicRationale: "Rejected publicly.",
            conflictPublicSummary: null,
            revisionSummary: null,
          },
          {
            id: "claim-1",
            title: "Accepted claim",
            summary: "Summary",
            approachLabel: "Approach",
            workflowState: "accepted",
            moderationVisibility: "visible",
            workflowPublicRationale: "Accepted after review of limitations.",
            conflictPublicSummary: null,
            revisionSummary: null,
          },
        ],
        evidence: [
          {
            id: "ev-hidden",
            sourceUrl: "https://example.ostt.synth.test/hidden",
            title: "Hidden",
            organization: "Desk",
            authorType: "agency",
            sourceType: "memo",
            limitations: "x",
            workflowState: "accepted",
            qualityStatus: "accepted",
            moderationVisibility: "hidden",
            qualityPublicRationale: "Quality ok",
            workflowPublicRationale: "Workflow ok",
            revisionSummary: null,
          },
          {
            id: "ev-db-1",
            sourceUrl: "https://example.ostt.synth.test/memo",
            title: "Memo",
            organization: "Desk",
            authorType: "agency",
            sourceType: "memo",
            limitations: "Synthetic only",
            workflowState: "accepted",
            qualityStatus: "limited",
            moderationVisibility: "visible",
            qualityPublicRationale: "Useful but limited for recommendation.",
            workflowPublicRationale: "Workflow accepted after review.",
            revisionSummary: null,
          },
        ],
        links: [
          {
            topicId: "topic-1",
            claimId: "claim-rejected",
            evidenceSubmissionId: "ev-db-1",
            relationship: "supporting",
          },
          {
            topicId: "topic-1",
            claimId: "claim-1",
            evidenceSubmissionId: "ev-hidden",
            relationship: "supporting",
          },
          {
            topicId: "topic-1",
            claimId: "claim-1",
            evidenceSubmissionId: "ev-db-1",
            relationship: "supporting",
          },
        ],
      }),
    );
    expect(projection).not.toBeNull();
    expect(projection!.claims).toHaveLength(1);
    expect(projection!.claims[0]!.title).toBe("Accepted claim");
    expect(projection!.evidence.map((e) => e.title)).toEqual(["Memo"]);
  });

  it("omits malformed non-http(s) URLs and never requires a fetch", () => {
    expect(
      buildPublicTopicProjection(
        baseInput({
          evidence: [
            {
              ...baseInput().evidence[0]!,
              sourceUrl: "javascript:alert(1)",
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("requires non-pending quality with public quality rationale", () => {
    expect(
      buildPublicTopicProjection(
        baseInput({
          evidence: [
            {
              ...baseInput().evidence[0]!,
              qualityStatus: "pending",
              qualityPublicRationale: null,
            },
          ],
        }),
      ),
    ).toBeNull();
  });
});
