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

function assertUniqueIds(
  collection: string,
  ids: string[],
  errors: string[],
) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`Duplicate ${collection} id: ${id}`);
    }
    seen.add(id);
  }
}

function assertSubset(
  parentLabel: string,
  childLabel: string,
  parentIds: string[],
  childIds: string[],
  errors: string[],
) {
  const parent = new Set(parentIds);
  for (const id of childIds) {
    if (!parent.has(id)) {
      errors.push(`${childLabel} ${id} is not in ${parentLabel}`);
    }
  }
}

/** Parse with Zod, then verify foreign-key and consistency relationships. */
export function parseAndAssertCatalog(data: unknown): FixtureCatalog {
  const catalog = fixtureCatalogSchema.parse(data);
  const errors = collectRelationshipErrors(catalog);
  if (errors.length > 0) {
    throw new Error(`Fixture relationship errors:\n- ${errors.join("\n- ")}`);
  }
  return catalog;
}

export function collectRelationshipErrors(catalog: FixtureCatalog): string[] {
  const errors: string[] = [];

  assertUniqueIds(
    "topic",
    catalog.topics.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "claim",
    catalog.claims.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "evidenceSource",
    catalog.evidenceSources.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "consultationStatement",
    catalog.consultationStatements.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "opinionGroup",
    catalog.opinionGroups.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "consultationResult",
    catalog.consultationResults.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "agendaItem",
    catalog.agendaItems.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "proposal",
    catalog.proposals.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "amendment",
    catalog.amendments.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "councilParticipant",
    catalog.councilParticipants.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "conflictDisclosure",
    catalog.conflictDisclosures.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "deliberation",
    catalog.deliberations.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "decision",
    catalog.decisions.map((item) => item.id),
    errors,
  );
  assertUniqueIds(
    "auditEvent",
    catalog.auditEvents.map((item) => item.id),
    errors,
  );

  const topicIds = new Set(catalog.topics.map((item) => item.id));
  const claimsById = new Map(catalog.claims.map((item) => [item.id, item]));
  const evidenceById = new Map(
    catalog.evidenceSources.map((item) => [item.id, item]),
  );
  const statementsById = new Map(
    catalog.consultationStatements.map((item) => [item.id, item]),
  );
  const groupIds = new Set(catalog.opinionGroups.map((item) => item.id));
  const consultationsById = new Map(
    catalog.consultationResults.map((item) => [item.id, item]),
  );
  const agendaById = new Map(catalog.agendaItems.map((item) => [item.id, item]));
  const proposalsById = new Map(catalog.proposals.map((item) => [item.id, item]));
  const amendmentsById = new Map(
    catalog.amendments.map((item) => [item.id, item]),
  );
  const participantsById = new Map(
    catalog.councilParticipants.map((item) => [item.id, item]),
  );
  const conflictsById = new Map(
    catalog.conflictDisclosures.map((item) => [item.id, item]),
  );
  const deliberationsById = new Map(
    catalog.deliberations.map((item) => [item.id, item]),
  );

  for (const topic of catalog.topics) {
    for (const claimId of topic.claimIds) {
      const claim = claimsById.get(claimId);
      if (!claim) {
        errors.push(`Missing claim id: ${claimId}`);
        continue;
      }
      if (claim.topicId !== topic.id) {
        errors.push(
          `Topic ${topic.id} lists claim ${claimId} from topic ${claim.topicId}`,
        );
      }
    }
  }

  for (const claim of catalog.claims) {
    assertId("topic", claim.topicId, topicIds, errors);
    for (const evidenceId of [
      ...claim.supportingEvidenceIds,
      ...claim.counterEvidenceIds,
    ]) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) {
        errors.push(`Missing evidenceSource id: ${evidenceId}`);
        continue;
      }
      if (evidence.topicId !== claim.topicId) {
        errors.push(
          `Claim ${claim.id} links evidence ${evidenceId} from topic ${evidence.topicId}`,
        );
      }
    }
  }

  for (const source of catalog.evidenceSources) {
    assertId("topic", source.topicId, topicIds, errors);
  }

  for (const statement of catalog.consultationStatements) {
    assertId("topic", statement.topicId, topicIds, errors);
    for (const claimId of statement.relatedClaimIds) {
      const claim = claimsById.get(claimId);
      if (!claim) {
        errors.push(`Missing claim id: ${claimId}`);
        continue;
      }
      if (claim.topicId !== statement.topicId) {
        errors.push(
          `Statement ${statement.id} links claim ${claimId} from another topic`,
        );
      }
    }
    for (const evidenceId of statement.relatedEvidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) {
        errors.push(`Missing evidenceSource id: ${evidenceId}`);
        continue;
      }
      if (evidence.topicId !== statement.topicId) {
        errors.push(
          `Statement ${statement.id} links evidence ${evidenceId} from another topic`,
        );
      }
    }
  }

  for (const result of catalog.consultationResults) {
    assertId("topic", result.topicId, topicIds, errors);
    for (const groupId of result.opinionGroupIds) {
      assertId("opinionGroup", groupId, groupIds, errors);
    }
    assertUniqueIds(
      `consultationResult ${result.id} statementIds`,
      result.statementIds,
      errors,
    );
    assertSubset(
      `consultationResult ${result.id} statementIds`,
      "consensusStatementId",
      result.statementIds,
      result.consensusStatementIds,
      errors,
    );
    assertSubset(
      `consultationResult ${result.id} statementIds`,
      "highDisagreementStatementId",
      result.statementIds,
      result.highDisagreementStatementIds,
      errors,
    );

    const metricStatementIds = result.statementMetrics.map(
      (metric) => metric.statementId,
    );
    assertUniqueIds(
      `consultationResult ${result.id} statementMetrics`,
      metricStatementIds,
      errors,
    );
    assertSubset(
      `consultationResult ${result.id} statementIds`,
      "statementMetric",
      result.statementIds,
      metricStatementIds,
      errors,
    );

    for (const statementId of result.statementIds) {
      const statement = statementsById.get(statementId);
      if (!statement) {
        errors.push(`Missing consultationStatement id: ${statementId}`);
        continue;
      }
      if (statement.topicId !== result.topicId) {
        errors.push(
          `Consultation result ${result.id} includes statement ${statementId} from another topic`,
        );
      }
    }

    for (const metric of result.statementMetrics) {
      for (const groupId of Object.keys(metric.groupAgreeShares)) {
        assertId("opinionGroup", groupId, groupIds, errors);
      }
    }
  }

  for (const item of catalog.agendaItems) {
    assertId("topic", item.topicId, topicIds, errors);
    if (item.state !== item.humanReview.decision) {
      errors.push(
        `Agenda item ${item.id} state (${item.state}) disagrees with humanReview.decision (${item.humanReview.decision})`,
      );
    }
    const consultation = consultationsById.get(item.consultationResultId);
    if (!consultation) {
      errors.push(`Missing consultationResult id: ${item.consultationResultId}`);
    } else if (consultation.topicId !== item.topicId) {
      errors.push(
        `Agenda item ${item.id} links consultation from another topic`,
      );
    }
  }

  for (const proposal of catalog.proposals) {
    assertId("topic", proposal.topicId, topicIds, errors);
  }

  const proposalIds = new Set(proposalsById.keys());
  const participantIds = new Set(participantsById.keys());

  for (const amendment of catalog.amendments) {
    assertId("proposal", amendment.proposalId, proposalIds, errors);
  }

  for (const disclosure of catalog.conflictDisclosures) {
    assertId(
      "councilParticipant",
      disclosure.participantId,
      participantIds,
      errors,
    );
  }

  for (const deliberation of catalog.deliberations) {
    assertId("topic", deliberation.topicId, topicIds, errors);
    const agenda = agendaById.get(deliberation.agendaItemId);
    if (!agenda) {
      errors.push(`Missing agendaItem id: ${deliberation.agendaItemId}`);
    } else if (agenda.topicId !== deliberation.topicId) {
      errors.push(
        `Deliberation ${deliberation.id} links agenda item from another topic`,
      );
    }

    const memberIds = new Set(deliberation.participantIds);
    assertUniqueIds(
      `deliberation ${deliberation.id} participantIds`,
      deliberation.participantIds,
      errors,
    );

    for (const participantId of deliberation.participantIds) {
      assertId("councilParticipant", participantId, participantIds, errors);
    }
    for (const conflictId of deliberation.conflictDisclosureIds) {
      const disclosure = conflictsById.get(conflictId);
      if (!disclosure) {
        errors.push(`Missing conflictDisclosure id: ${conflictId}`);
        continue;
      }
      if (!memberIds.has(disclosure.participantId)) {
        errors.push(
          `Deliberation ${deliberation.id} conflict ${conflictId} is for a non-member`,
        );
      }
    }
    for (const proposalId of deliberation.proposalIds) {
      const proposal = proposalsById.get(proposalId);
      if (!proposal) {
        errors.push(`Missing proposal id: ${proposalId}`);
        continue;
      }
      if (proposal.topicId !== deliberation.topicId) {
        errors.push(
          `Deliberation ${deliberation.id} links proposal ${proposalId} from another topic`,
        );
      }
    }
    for (const amendmentId of deliberation.amendmentIds) {
      const amendment = amendmentsById.get(amendmentId);
      if (!amendment) {
        errors.push(`Missing amendment id: ${amendmentId}`);
        continue;
      }
      if (!deliberation.proposalIds.includes(amendment.proposalId)) {
        errors.push(
          `Deliberation ${deliberation.id} amendment ${amendmentId} points outside proposal set`,
        );
      }
    }
    if (!memberIds.has(deliberation.recusal.participantId)) {
      errors.push(
        `Deliberation ${deliberation.id} recusal participant is not a member`,
      );
    }
    for (const evidenceId of deliberation.evidenceRequest.relatedEvidenceIds) {
      const source = evidenceById.get(evidenceId);
      if (!source) {
        errors.push(
          `Deliberation ${deliberation.id} evidence request links missing evidence ${evidenceId}`,
        );
      } else if (source.topicId !== deliberation.topicId) {
        errors.push(
          `Deliberation ${deliberation.id} evidence request links evidence from another topic`,
        );
      }
    }
  }

  for (const decision of catalog.decisions) {
    assertId("topic", decision.topicId, topicIds, errors);
    const deliberation = deliberationsById.get(decision.deliberationId);
    if (!deliberation) {
      errors.push(`Missing deliberation id: ${decision.deliberationId}`);
      continue;
    }
    if (deliberation.topicId !== decision.topicId) {
      errors.push(
        `Decision ${decision.id} links deliberation from another topic`,
      );
    }

    const memberIds = new Set(deliberation.participantIds);
    const votingMemberIds = new Set(
      deliberation.participantIds.filter((participantId) => {
        const participant = participantsById.get(participantId);
        return participant?.voting;
      }),
    );

    assertId("proposal", decision.finalProposalId, proposalIds, errors);
    for (const proposalId of decision.proposalVersionIds) {
      assertId("proposal", proposalId, proposalIds, errors);
      if (!deliberation.proposalIds.includes(proposalId)) {
        errors.push(
          `Decision ${decision.id} proposal version ${proposalId} not in deliberation`,
        );
      }
    }

    assertUniqueIds(
      `decision ${decision.id} rollCall`,
      decision.rollCall.map((entry) => entry.participantId),
      errors,
    );

    for (const entry of decision.rollCall) {
      if (!memberIds.has(entry.participantId)) {
        errors.push(
          `Decision ${decision.id} roll-call participant ${entry.participantId} is not a deliberation member`,
        );
      }
      const participant = participantsById.get(entry.participantId);
      if (participant && !participant.voting) {
        errors.push(
          `Decision ${decision.id} includes nonvoting participant ${entry.participantId} in roll call`,
        );
      }
    }

    for (const authorId of decision.minorityReport.authorParticipantIds) {
      if (!memberIds.has(authorId)) {
        errors.push(
          `Decision ${decision.id} minority author ${authorId} is not a deliberation member`,
        );
      }
      if (!votingMemberIds.has(authorId)) {
        errors.push(
          `Decision ${decision.id} minority author ${authorId} is not a voting member`,
        );
      }
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
