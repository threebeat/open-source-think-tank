import { describe, expect, it } from "vitest";

import {
  buildPublicTopicProjection,
  isPublicEligibleEvidenceQuality,
  projectionContainsForbiddenKeys,
  type BuildPublicTopicProjectionInput,
} from "@/lib/topics/public-projection";

const PRIVATE_EVIDENCE_DETAIL_SENTINEL =
  "SENTINEL_EVIDENCE_PRIVATE_DETAIL_MUST_NEVER_LEAK_9f3c";
const PRIVATE_CLAIM_DETAIL_SENTINEL =
  "SENTINEL_CLAIM_PRIVATE_DETAIL_MUST_NEVER_LEAK_2a1b";
const HELD_TITLE_SENTINEL = "SENTINEL_HELD_CLAIM_TITLE_LEAK";
const REJECTED_URL_SENTINEL =
  "https://example.ostt.synth.test/rejected-quality-must-not-appear";

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
        latestModerationNotice: null,
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
        conflictPublicSummary:
          "Evidence author notes a prior consulting engagement (synthetic).",
        revisionSummary: null,
        latestModerationNotice: null,
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
  it("returns allowlisted DTO for publishable content including evidence conflict summary", () => {
    const projection = buildPublicTopicProjection(baseInput());
    expect(projection).not.toBeNull();
    expect(projection!.slug).toBe("alpha-topic");
    expect(projection!.claims).toHaveLength(1);
    expect(projection!.evidence).toHaveLength(1);
    expect(projection!.evidence[0]!.key).toBe("ev-1");
    expect(projection!.claims[0]!.evidenceLinks[0]!.evidenceKey).toBe("ev-1");
    expect(projection!.evidence[0]!.conflictPublicSummary).toContain(
      "prior consulting engagement",
    );
    expect(projection!.withheldModerationNotices).toEqual([]);
    expect(projection!.claims[0]!.latestRestorationNotice).toBeNull();
    expect(projection!.evidence[0]!.latestRestorationNotice).toBeNull();
    expect(projectionContainsForbiddenKeys(projection)).toEqual([]);
    expect(JSON.stringify(projection)).not.toContain("ev-db-1");
    expect(JSON.stringify(projection)).not.toContain("private");
    expect(JSON.stringify(projection)).not.toContain(
      PRIVATE_EVIDENCE_DETAIL_SENTINEL,
    );
    expect(JSON.stringify(projection)).not.toContain(
      PRIVATE_CLAIM_DETAIL_SENTINEL,
    );
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

  it("keeps a published topic addressable when every content item is excluded", () => {
    const projection = buildPublicTopicProjection(
      baseInput({
        claims: [
          {
            id: "claim-held",
            title: HELD_TITLE_SENTINEL,
            summary: "Secret held claim summary",
            approachLabel: "Approach",
            workflowState: "accepted",
            moderationVisibility: "held",
            workflowPublicRationale: "Accepted earlier.",
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: {
              action: "hold",
              publicRationale: "Temporarily withheld for staff follow-up.",
              recordedAt: "2026-08-11T15:00:00.000Z",
            },
          },
        ],
        evidence: [
          {
            ...baseInput().evidence[0]!,
            qualityStatus: "rejected",
            qualityPublicRationale: "Rejected for publication.",
            sourceUrl: REJECTED_URL_SENTINEL,
            conflictPublicSummary: null,
          },
        ],
        links: [
          {
            topicId: "topic-1",
            claimId: "claim-held",
            evidenceSubmissionId: "ev-db-1",
            relationship: "supporting",
          },
        ],
      }),
    );

    expect(projection).not.toBeNull();
    expect(projection!.slug).toBe("alpha-topic");
    expect(projection!.claims).toEqual([]);
    expect(projection!.evidence).toEqual([]);
    expect(projection!.withheldModerationNotices).toEqual([
      {
        subjectKind: "claim",
        action: "hold",
        publicRationale: "Temporarily withheld for staff follow-up.",
        recordedAt: "2026-08-11T15:00:00.000Z",
      },
    ]);
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain(HELD_TITLE_SENTINEL);
    expect(serialized).not.toContain(REJECTED_URL_SENTINEL);
    expect(serialized).not.toContain("Secret held claim summary");
  });

  it("preserves paused operational label without unpublishing", () => {
    const projection = buildPublicTopicProjection(
      baseInput({
        topic: {
          ...baseInput().topic,
          workflowState: "paused",
        },
      }),
    );
    expect(projection).not.toBeNull();
    expect(projection!.operationalLabel).toBe("Paused (operational)");
    expect(projection!.claims).toHaveLength(1);
  });

  it("omits workflow-rejected claims and quality-rejected evidence", () => {
    const projection = buildPublicTopicProjection(
      baseInput({
        claims: [
          {
            id: "claim-rejected",
            title: "Rejected claim title",
            summary: "x",
            approachLabel: "a",
            workflowState: "rejected",
            moderationVisibility: "visible",
            workflowPublicRationale: "Rejected publicly.",
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: null,
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
            latestModerationNotice: null,
          },
        ],
        evidence: [
          {
            id: "ev-rejected-quality",
            sourceUrl: REJECTED_URL_SENTINEL,
            title: "Rejected quality evidence",
            organization: "Desk",
            authorType: "agency",
            sourceType: "memo",
            limitations: "x",
            workflowState: "accepted",
            qualityStatus: "rejected",
            moderationVisibility: "visible",
            qualityPublicRationale: "Quality rejected after review.",
            workflowPublicRationale: "Workflow accepted earlier.",
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: null,
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
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: null,
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
            evidenceSubmissionId: "ev-rejected-quality",
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
    expect(JSON.stringify(projection)).not.toContain("Rejected claim title");
    expect(JSON.stringify(projection)).not.toContain(
      "Rejected quality evidence",
    );
    expect(JSON.stringify(projection)).not.toContain(REJECTED_URL_SENTINEL);
  });

  it("includes accepted, limited, and disputed quality when otherwise eligible", () => {
    for (const qualityStatus of ["accepted", "limited", "disputed"] as const) {
      expect(isPublicEligibleEvidenceQuality(qualityStatus)).toBe(true);
      const projection = buildPublicTopicProjection(
        baseInput({
          evidence: [
            {
              ...baseInput().evidence[0]!,
              qualityStatus,
              qualityPublicRationale: `${qualityStatus} rationale`,
            },
          ],
        }),
      );
      expect(projection).not.toBeNull();
      expect(projection!.evidence[0]!.qualityStatus).toBe(qualityStatus);
    }
  });

  it("exposes withhold notice without leaking titles or bodies", () => {
    const projection = buildPublicTopicProjection(
      baseInput({
        claims: [
          {
            id: "claim-held",
            title: "Secret held claim title",
            summary: "Secret held claim summary",
            approachLabel: "Approach",
            workflowState: "accepted",
            moderationVisibility: "held",
            workflowPublicRationale: "Accepted earlier.",
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: {
              action: "hold",
              publicRationale: "Temporarily withheld for staff follow-up.",
              recordedAt: "2026-08-11T15:00:00.000Z",
            },
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
            latestModerationNotice: null,
          },
        ],
        evidence: [
          {
            id: "ev-hidden",
            sourceUrl: "https://example.ostt.synth.test/hidden-title-leak",
            title: "Secret hidden evidence title",
            organization: "Desk",
            authorType: "agency",
            sourceType: "memo",
            limitations: "Secret limitations text",
            workflowState: "accepted",
            qualityStatus: "accepted",
            moderationVisibility: "hidden",
            qualityPublicRationale: "Quality ok",
            workflowPublicRationale: "Workflow ok",
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: {
              action: "hide",
              publicRationale: "Hidden pending source clarification.",
              recordedAt: "2026-08-11T16:00:00.000Z",
            },
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
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: null,
          },
        ],
        links: [
          {
            topicId: "topic-1",
            claimId: "claim-held",
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
    expect(projection!.withheldModerationNotices).toEqual([
      {
        subjectKind: "claim",
        action: "hold",
        publicRationale: "Temporarily withheld for staff follow-up.",
        recordedAt: "2026-08-11T15:00:00.000Z",
      },
      {
        subjectKind: "evidence",
        action: "hide",
        publicRationale: "Hidden pending source clarification.",
        recordedAt: "2026-08-11T16:00:00.000Z",
      },
    ]);
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain("Secret held claim title");
    expect(serialized).not.toContain("Secret held claim summary");
    expect(serialized).not.toContain("Secret hidden evidence title");
    expect(serialized).not.toContain("Secret limitations text");
    expect(serialized).not.toContain("hidden-title-leak");
    expect(projectionContainsForbiddenKeys(projection)).toEqual([]);
  });

  it("attaches restore notice on currently visible content", () => {
    const projection = buildPublicTopicProjection(
      baseInput({
        claims: [
          {
            ...baseInput().claims[0]!,
            latestModerationNotice: {
              action: "restore",
              publicRationale: "Restored after clarification.",
              recordedAt: "2026-08-11T17:00:00.000Z",
            },
          },
        ],
        evidence: [
          {
            ...baseInput().evidence[0]!,
            latestModerationNotice: {
              action: "restore",
              publicRationale: "Evidence restored to the publication.",
              recordedAt: "2026-08-11T17:30:00.000Z",
            },
          },
        ],
      }),
    );

    expect(projection).not.toBeNull();
    expect(projection!.claims[0]!.latestRestorationNotice).toEqual({
      subjectKind: "claim",
      action: "restore",
      publicRationale: "Restored after clarification.",
      recordedAt: "2026-08-11T17:00:00.000Z",
    });
    expect(projection!.evidence[0]!.latestRestorationNotice).toEqual({
      subjectKind: "evidence",
      action: "restore",
      publicRationale: "Evidence restored to the publication.",
      recordedAt: "2026-08-11T17:30:00.000Z",
    });
    expect(projection!.withheldModerationNotices).toEqual([]);
  });

  it("omits malformed non-http(s) URLs from included evidence and keeps published shell", () => {
    const projection = buildPublicTopicProjection(
      baseInput({
        evidence: [
          {
            ...baseInput().evidence[0]!,
            sourceUrl: "javascript:alert(1)",
          },
        ],
      }),
    );
    expect(projection).not.toBeNull();
    expect(projection!.claims).toEqual([]);
    expect(projection!.evidence).toEqual([]);
    expect(JSON.stringify(projection)).not.toContain("javascript:");
  });

  it("requires non-pending quality with public quality rationale", () => {
    const projection = buildPublicTopicProjection(
      baseInput({
        evidence: [
          {
            ...baseInput().evidence[0]!,
            qualityStatus: "pending",
            qualityPublicRationale: null,
          },
        ],
      }),
    );
    expect(projection).not.toBeNull();
    expect(projection!.claims).toEqual([]);
    expect(projection!.evidence).toEqual([]);
  });

  it("orders claims, evidence links, and notices deterministically", () => {
    const projection = buildPublicTopicProjection(
      baseInput({
        claims: [
          {
            id: "claim-z",
            title: "Zulu claim",
            summary: "Z",
            approachLabel: "B",
            workflowState: "accepted",
            moderationVisibility: "visible",
            workflowPublicRationale: "Accepted Z.",
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: null,
          },
          {
            id: "claim-a",
            title: "Alpha claim",
            summary: "A",
            approachLabel: "A",
            workflowState: "accepted",
            moderationVisibility: "visible",
            workflowPublicRationale: "Accepted A.",
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: null,
          },
        ],
        evidence: [
          {
            id: "ev-b",
            sourceUrl: "https://example.ostt.synth.test/b",
            title: "Bravo source",
            organization: "Desk",
            authorType: "agency",
            sourceType: "memo",
            limitations: "b",
            workflowState: "accepted",
            qualityStatus: "accepted",
            moderationVisibility: "visible",
            qualityPublicRationale: "ok",
            workflowPublicRationale: "ok",
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: null,
          },
          {
            id: "ev-a",
            sourceUrl: "https://example.ostt.synth.test/a",
            title: "Alpha source",
            organization: "Desk",
            authorType: "agency",
            sourceType: "memo",
            limitations: "a",
            workflowState: "accepted",
            qualityStatus: "accepted",
            moderationVisibility: "visible",
            qualityPublicRationale: "ok",
            workflowPublicRationale: "ok",
            conflictPublicSummary: null,
            revisionSummary: null,
            latestModerationNotice: null,
          },
        ],
        links: [
          {
            topicId: "topic-1",
            claimId: "claim-z",
            evidenceSubmissionId: "ev-b",
            relationship: "counterevidence",
          },
          {
            topicId: "topic-1",
            claimId: "claim-z",
            evidenceSubmissionId: "ev-a",
            relationship: "supporting",
          },
          {
            topicId: "topic-1",
            claimId: "claim-a",
            evidenceSubmissionId: "ev-a",
            relationship: "supporting",
          },
        ],
      }),
    );

    expect(projection).not.toBeNull();
    expect(projection!.claims.map((c) => c.title)).toEqual([
      "Alpha claim",
      "Zulu claim",
    ]);
    expect(projection!.claims[1]!.evidenceLinks.map((l) => l.relationship)).toEqual([
      "supporting",
      "counterevidence",
    ]);
    expect(projection!.evidence.map((e) => e.title)).toEqual([
      "Alpha source",
      "Bravo source",
    ]);
  });
});
