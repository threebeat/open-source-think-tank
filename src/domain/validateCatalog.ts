import { fixtureCatalogSchema } from "@/domain/schemas";
import type { FixtureCatalog } from "@/domain/types";

function assertId(
  collection: string,
  id: string,
  known: Set<string>,
  errors: string[],
) {
  if (!known.has(id)) {
    errors.push(`Missing ${collection} id: ${id}`);
  }
}

/** Parse with Zod, then verify foreign-key relationships. */
export function parseAndAssertCatalog(data: unknown): FixtureCatalog {
  const catalog = fixtureCatalogSchema.parse(data);
  const errors = collectRelationshipErrors(catalog);
  if (errors.length > 0) {
    throw new Error(
      `Fixture relationship errors:\n- ${errors.join("\n- ")}`,
    );
  }
  return catalog;
}

export function collectRelationshipErrors(catalog: FixtureCatalog): string[] {
  const errors: string[] = [];
  const topicIds = new Set(catalog.topics.map((item) => item.id));
  const claimIds = new Set(catalog.claims.map((item) => item.id));
  const evidenceIds = new Set(catalog.evidenceSources.map((item) => item.id));
  const statementIds = new Set(
    catalog.consultationStatements.map((item) => item.id),
  );
  const groupIds = new Set(catalog.opinionGroups.map((item) => item.id));
  const consultationIds = new Set(
    catalog.consultationResults.map((item) => item.id),
  );
  const agendaIds = new Set(catalog.agendaItems.map((item) => item.id));
  const proposalIds = new Set(catalog.proposals.map((item) => item.id));
  const amendmentIds = new Set(catalog.amendments.map((item) => item.id));
  const participantIds = new Set(
    catalog.councilParticipants.map((item) => item.id),
  );
  const conflictIds = new Set(
    catalog.conflictDisclosures.map((item) => item.id),
  );
  const deliberationIds = new Set(catalog.deliberations.map((item) => item.id));

  for (const topic of catalog.topics) {
    for (const claimId of topic.claimIds) {
      assertId("claim", claimId, claimIds, errors);
    }
  }

  for (const claim of catalog.claims) {
    assertId("topic", claim.topicId, topicIds, errors);
    for (const evidenceId of [
      ...claim.supportingEvidenceIds,
      ...claim.counterEvidenceIds,
    ]) {
      assertId("evidenceSource", evidenceId, evidenceIds, errors);
    }
  }

  for (const source of catalog.evidenceSources) {
    assertId("topic", source.topicId, topicIds, errors);
  }

  for (const statement of catalog.consultationStatements) {
    assertId("topic", statement.topicId, topicIds, errors);
    for (const claimId of statement.relatedClaimIds) {
      assertId("claim", claimId, claimIds, errors);
    }
    for (const evidenceId of statement.relatedEvidenceIds) {
      assertId("evidenceSource", evidenceId, evidenceIds, errors);
    }
  }

  for (const result of catalog.consultationResults) {
    assertId("topic", result.topicId, topicIds, errors);
    for (const groupId of result.opinionGroupIds) {
      assertId("opinionGroup", groupId, groupIds, errors);
    }
    for (const statementId of [
      ...result.statementIds,
      ...result.consensusStatementIds,
      ...result.highDisagreementStatementIds,
    ]) {
      assertId("consultationStatement", statementId, statementIds, errors);
    }
  }

  for (const item of catalog.agendaItems) {
    assertId("topic", item.topicId, topicIds, errors);
    assertId(
      "consultationResult",
      item.consultationResultId,
      consultationIds,
      errors,
    );
  }

  for (const proposal of catalog.proposals) {
    assertId("topic", proposal.topicId, topicIds, errors);
  }

  for (const amendment of catalog.amendments) {
    assertId("proposal", amendment.proposalId, proposalIds, errors);
  }

  for (const disclosure of catalog.conflictDisclosures) {
    assertId("councilParticipant", disclosure.participantId, participantIds, errors);
  }

  for (const deliberation of catalog.deliberations) {
    assertId("topic", deliberation.topicId, topicIds, errors);
    assertId("agendaItem", deliberation.agendaItemId, agendaIds, errors);
    for (const participantId of deliberation.participantIds) {
      assertId("councilParticipant", participantId, participantIds, errors);
    }
    for (const conflictId of deliberation.conflictDisclosureIds) {
      assertId("conflictDisclosure", conflictId, conflictIds, errors);
    }
    for (const proposalId of deliberation.proposalIds) {
      assertId("proposal", proposalId, proposalIds, errors);
    }
    for (const amendmentId of deliberation.amendmentIds) {
      assertId("amendment", amendmentId, amendmentIds, errors);
    }
    assertId(
      "councilParticipant",
      deliberation.recusal.participantId,
      participantIds,
      errors,
    );
  }

  for (const decision of catalog.decisions) {
    assertId("topic", decision.topicId, topicIds, errors);
    assertId("deliberation", decision.deliberationId, deliberationIds, errors);
    assertId("proposal", decision.finalProposalId, proposalIds, errors);
    for (const entry of decision.rollCall) {
      assertId("councilParticipant", entry.participantId, participantIds, errors);
    }
    for (const authorId of decision.minorityReport.authorParticipantIds) {
      assertId("councilParticipant", authorId, participantIds, errors);
    }
    for (const proposalId of decision.proposalVersionIds) {
      assertId("proposal", proposalId, proposalIds, errors);
    }

    const forCount = decision.rollCall.filter((entry) => entry.vote === "for")
      .length;
    const againstCount = decision.rollCall.filter(
      (entry) => entry.vote === "against",
    ).length;
    const abstainCount = decision.rollCall.filter(
      (entry) => entry.vote === "abstain",
    ).length;
    if (forCount !== decision.voteFor) {
      errors.push(`Decision ${decision.id} voteFor does not match roll call`);
    }
    if (againstCount !== decision.voteAgainst) {
      errors.push(
        `Decision ${decision.id} voteAgainst does not match roll call`,
      );
    }
    if (abstainCount !== decision.voteAbstain) {
      errors.push(
        `Decision ${decision.id} voteAbstain does not match roll call`,
      );
    }
  }

  return errors;
}
