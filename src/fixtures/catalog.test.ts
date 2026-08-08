import { describe, expect, it } from "vitest";

import { fixtureCatalogSchema } from "@/domain/schemas";
import {
  getAgendaItemBySlug,
  getDecisionBySlug,
  getDeliberationBySlug,
  getFeaturedTopic,
  getScenarioBundle,
  getTopicBySlug,
} from "@/domain/selectors";
import { parseAndAssertCatalog } from "@/domain/validateCatalog";
import { fixtureCatalog, rawFixtureCatalog } from "@/fixtures";

function ids(items: { id: string }[]): Set<string> {
  return new Set(items.map((item) => item.id));
}

describe("fixture catalog", () => {
  it("marks the catalog and every top-level entity as synthetic", () => {
    expect(fixtureCatalog.synthetic).toBe(true);
    expect(fixtureCatalog.topics.every((topic) => topic.synthetic)).toBe(true);
    expect(
      fixtureCatalog.consultationResults.every((item) => item.synthetic),
    ).toBe(true);
    expect(fixtureCatalog.agendaItems.every((item) => item.synthetic)).toBe(
      true,
    );
    expect(fixtureCatalog.deliberations.every((item) => item.synthetic)).toBe(
      true,
    );
    expect(fixtureCatalog.decisions.every((item) => item.synthetic)).toBe(true);
    expect(fixtureCatalog.auditEvents.every((item) => item.synthetic)).toBe(
      true,
    );
  });

  it("includes one complete scenario and two earlier-stage topics", () => {
    expect(fixtureCatalog.topics).toHaveLength(3);

    const complete = getTopicBySlug(
      fixtureCatalog,
      "cedar-river-drought-surcharge",
    );
    const brief = getTopicBySlug(fixtureCatalog, "millbrook-ems-open-data");
    const evidence = getTopicBySlug(
      fixtureCatalog,
      "northline-secondary-start-times",
    );

    expect(complete?.stage).toBe("decision");
    expect(brief?.stage).toBe("brief");
    expect(evidence?.stage).toBe("evidence");
  });

  it("meets Section 7 completeness checks for the Cedar River scenario", () => {
    const bundle = getScenarioBundle(
      fixtureCatalog,
      "cedar-river-drought-surcharge",
    );
    expect(bundle).toBeDefined();
    if (!bundle) {
      return;
    }

    expect(bundle.claims.length).toBeGreaterThanOrEqual(3);
    expect(bundle.evidenceSources.length).toBeGreaterThanOrEqual(6);
    expect(
      new Set(bundle.evidenceSources.map((source) => source.reviewStatus)).size,
    ).toBeGreaterThanOrEqual(4);
    expect(bundle.consultationStatements.length).toBeGreaterThanOrEqual(8);
    expect(fixtureCatalog.opinionGroups.map((group) => group.label)).toEqual([
      "Group A",
      "Group B",
      "Group C",
    ]);

    const statements = bundle.consultationStatements;
    expect(
      statements.filter((statement) => statement.isCrossGroupConsensus).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      statements.filter((statement) => statement.isHighDisagreement).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      statements.some((statement) => statement.isPopularWeakEvidence),
    ).toBe(true);
    expect(
      statements.some((statement) => statement.isLessPopularStrongEvidence),
    ).toBe(true);

    expect(bundle.agendaItem?.humanReview).toBeDefined();
    expect(bundle.deliberation?.amendmentIds.length).toBeGreaterThanOrEqual(2);
    expect(bundle.deliberation?.evidenceRequest).toBeDefined();
    expect(bundle.deliberation?.recusal).toBeDefined();
    expect(bundle.decision?.minorityReport).toBeDefined();
    expect(bundle.decision?.reviewOn).toBeTruthy();
  });

  it("keeps opinion group labels free of ideology or identity inference", () => {
    const banned =
      /liberal|conservative|populist|establishment|urban|rural|democrat|republican/i;
    for (const group of fixtureCatalog.opinionGroups) {
      expect(group.label).not.toMatch(banned);
    }
  });

  it("fails validation when fixture relationships are broken", () => {
    const broken = structuredClone(rawFixtureCatalog);
    broken.claims[0].supportingEvidenceIds = ["evidence-does-not-exist"];

    expect(() => fixtureCatalogSchema.parse(broken)).not.toThrow();
    expect(() => parseAndAssertCatalog(broken)).toThrow(
      /evidence-does-not-exist/,
    );
  });

  it("rejects catalogs that drop the synthetic marker", () => {
    const broken = structuredClone(rawFixtureCatalog) as {
      synthetic: boolean;
      topics: Array<{ synthetic: boolean }>;
    };
    broken.synthetic = false;

    expect(() => fixtureCatalogSchema.parse(broken)).toThrow();
  });

  it("has stable selectors for topic, agenda, deliberation, and decision", () => {
    expect(getFeaturedTopic(fixtureCatalog).slug).toBe(
      "cedar-river-drought-surcharge",
    );
    expect(
      getAgendaItemBySlug(fixtureCatalog, "cedar-river-drought-surcharge")?.state,
    ).toBe("qualified");
    expect(
      getDeliberationBySlug(fixtureCatalog, "cedar-river-drought-surcharge")
        ?.recusal.participantId,
    ).toBe("council-ben-okonkwo");
    expect(
      getDecisionBySlug(fixtureCatalog, "cedar-river-drought-surcharge")?.outcome,
    ).toBe("adopted");
  });

  it("catches broken foreign keys across the catalog", () => {
    const topicIds = ids(fixtureCatalog.topics);
    const claimIds = ids(fixtureCatalog.claims);
    const evidenceIds = ids(fixtureCatalog.evidenceSources);
    const statementIds = ids(fixtureCatalog.consultationStatements);
    const groupIds = ids(fixtureCatalog.opinionGroups);
    const consultationIds = ids(fixtureCatalog.consultationResults);
    const agendaIds = ids(fixtureCatalog.agendaItems);
    const proposalIds = ids(fixtureCatalog.proposals);
    const amendmentIds = ids(fixtureCatalog.amendments);
    const participantIds = ids(fixtureCatalog.councilParticipants);
    const conflictIds = ids(fixtureCatalog.conflictDisclosures);
    const deliberationIds = ids(fixtureCatalog.deliberations);

    for (const topic of fixtureCatalog.topics) {
      for (const claimId of topic.claimIds) {
        expect(claimIds.has(claimId)).toBe(true);
      }
    }

    for (const claim of fixtureCatalog.claims) {
      expect(topicIds.has(claim.topicId)).toBe(true);
      for (const evidenceId of [
        ...claim.supportingEvidenceIds,
        ...claim.counterEvidenceIds,
      ]) {
        expect(evidenceIds.has(evidenceId)).toBe(true);
      }
    }

    for (const source of fixtureCatalog.evidenceSources) {
      expect(topicIds.has(source.topicId)).toBe(true);
    }

    for (const statement of fixtureCatalog.consultationStatements) {
      expect(topicIds.has(statement.topicId)).toBe(true);
      for (const claimId of statement.relatedClaimIds) {
        expect(claimIds.has(claimId)).toBe(true);
      }
      for (const evidenceId of statement.relatedEvidenceIds) {
        expect(evidenceIds.has(evidenceId)).toBe(true);
      }
    }

    for (const result of fixtureCatalog.consultationResults) {
      expect(topicIds.has(result.topicId)).toBe(true);
      for (const groupId of result.opinionGroupIds) {
        expect(groupIds.has(groupId)).toBe(true);
      }
      for (const statementId of result.statementIds) {
        expect(statementIds.has(statementId)).toBe(true);
      }
      for (const statementId of result.consensusStatementIds) {
        expect(statementIds.has(statementId)).toBe(true);
      }
      for (const statementId of result.highDisagreementStatementIds) {
        expect(statementIds.has(statementId)).toBe(true);
      }
    }

    for (const item of fixtureCatalog.agendaItems) {
      expect(topicIds.has(item.topicId)).toBe(true);
      expect(consultationIds.has(item.consultationResultId)).toBe(true);
    }

    for (const proposal of fixtureCatalog.proposals) {
      expect(topicIds.has(proposal.topicId)).toBe(true);
    }

    for (const amendment of fixtureCatalog.amendments) {
      expect(proposalIds.has(amendment.proposalId)).toBe(true);
    }

    for (const disclosure of fixtureCatalog.conflictDisclosures) {
      expect(participantIds.has(disclosure.participantId)).toBe(true);
    }

    for (const deliberation of fixtureCatalog.deliberations) {
      expect(topicIds.has(deliberation.topicId)).toBe(true);
      expect(agendaIds.has(deliberation.agendaItemId)).toBe(true);
      for (const participantId of deliberation.participantIds) {
        expect(participantIds.has(participantId)).toBe(true);
      }
      for (const conflictId of deliberation.conflictDisclosureIds) {
        expect(conflictIds.has(conflictId)).toBe(true);
      }
      for (const proposalId of deliberation.proposalIds) {
        expect(proposalIds.has(proposalId)).toBe(true);
      }
      for (const amendmentId of deliberation.amendmentIds) {
        expect(amendmentIds.has(amendmentId)).toBe(true);
      }
      expect(participantIds.has(deliberation.recusal.participantId)).toBe(true);
    }

    for (const decision of fixtureCatalog.decisions) {
      expect(topicIds.has(decision.topicId)).toBe(true);
      expect(deliberationIds.has(decision.deliberationId)).toBe(true);
      expect(proposalIds.has(decision.finalProposalId)).toBe(true);
      for (const entry of decision.rollCall) {
        expect(participantIds.has(entry.participantId)).toBe(true);
      }
      for (const authorId of decision.minorityReport.authorParticipantIds) {
        expect(participantIds.has(authorId)).toBe(true);
      }
      for (const proposalId of decision.proposalVersionIds) {
        expect(proposalIds.has(proposalId)).toBe(true);
      }

      const forCount = decision.rollCall.filter((entry) => entry.vote === "for")
        .length;
      const againstCount = decision.rollCall.filter(
        (entry) => entry.vote === "against",
      ).length;
      const abstainCount = decision.rollCall.filter(
        (entry) => entry.vote === "abstain",
      ).length;
      expect(forCount).toBe(decision.voteFor);
      expect(againstCount).toBe(decision.voteAgainst);
      expect(abstainCount).toBe(decision.voteAbstain);
    }
  });
});
