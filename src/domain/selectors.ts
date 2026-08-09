import type {
  AgendaItem,
  ConsultationResult,
  Decision,
  Deliberation,
  FixtureCatalog,
  Topic,
} from "@/domain/types";

function requireCatalog(catalog: FixtureCatalog): FixtureCatalog {
  return catalog;
}

export function listTopics(catalog: FixtureCatalog): Topic[] {
  return requireCatalog(catalog).topics;
}

export function getTopicBySlug(
  catalog: FixtureCatalog,
  slug: string,
): Topic | undefined {
  return catalog.topics.find((topic) => topic.slug === slug);
}

export function getTopicById(
  catalog: FixtureCatalog,
  id: string,
): Topic | undefined {
  return catalog.topics.find((topic) => topic.id === id);
}

export function getFeaturedTopic(catalog: FixtureCatalog): Topic {
  const featured = getTopicBySlug(catalog, "cedar-river-drought-surcharge");
  if (!featured) {
    throw new Error("Featured synthetic topic missing from catalog.");
  }
  return featured;
}

export function listAgendaItems(catalog: FixtureCatalog): AgendaItem[] {
  return catalog.agendaItems;
}

export function getAgendaItemBySlug(
  catalog: FixtureCatalog,
  slug: string,
): AgendaItem | undefined {
  return catalog.agendaItems.find((item) => item.slug === slug);
}

export function getAgendaItemsForTopic(
  catalog: FixtureCatalog,
  topicId: string,
): AgendaItem[] {
  return catalog.agendaItems.filter((item) => item.topicId === topicId);
}

export function getPrimaryAgendaItemForTopic(
  catalog: FixtureCatalog,
  topicId: string,
): AgendaItem | undefined {
  const items = getAgendaItemsForTopic(catalog, topicId);
  return (
    items.find((item) => item.state === "qualified") ??
    items.find((item) => item.state === "deferred") ??
    items[0]
  );
}

export function getDeliberationBySlug(
  catalog: FixtureCatalog,
  slug: string,
): Deliberation | undefined {
  return catalog.deliberations.find((item) => item.slug === slug);
}

export function listDeliberations(catalog: FixtureCatalog): Deliberation[] {
  return catalog.deliberations;
}

export function getDeliberationBundle(
  catalog: FixtureCatalog,
  slug: string,
) {
  const deliberation = getDeliberationBySlug(catalog, slug);
  if (!deliberation) {
    return undefined;
  }
  const topic = getTopicById(catalog, deliberation.topicId);
  if (!topic) {
    return undefined;
  }
  const agendaItem = catalog.agendaItems.find(
    (item) => item.id === deliberation.agendaItemId,
  );
  const participants = deliberation.participantIds
    .map((id) => catalog.councilParticipants.find((item) => item.id === id))
    .filter((item) => item != null);
  const conflicts = deliberation.conflictDisclosureIds
    .map((id) => catalog.conflictDisclosures.find((item) => item.id === id))
    .filter((item) => item != null);
  const proposals = deliberation.proposalIds
    .map((id) => catalog.proposals.find((item) => item.id === id))
    .filter((item) => item != null);
  const amendments = deliberation.amendmentIds
    .map((id) => catalog.amendments.find((item) => item.id === id))
    .filter((item) => item != null);
  const relatedEvidence = deliberation.evidenceRequest.relatedEvidenceIds
    .map((id) => catalog.evidenceSources.find((source) => source.id === id))
    .filter((source) => source != null);
  const claimsById = new Map(
    getClaimsForTopic(catalog, topic.id).map((claim) => [claim.id, claim]),
  );
  const statementsById = new Map(
    catalog.consultationStatements
      .filter((statement) => statement.topicId === topic.id)
      .map((statement) => [statement.id, statement]),
  );
  const evidenceById = new Map(
    getEvidenceForTopic(catalog, topic.id).map((source) => [source.id, source]),
  );

  return {
    deliberation,
    topic,
    agendaItem,
    participants,
    conflicts,
    proposals,
    amendments,
    relatedEvidence,
    claimsById,
    statementsById,
    evidenceById,
  };
}

export function getDecisionBySlug(
  catalog: FixtureCatalog,
  slug: string,
): Decision | undefined {
  return catalog.decisions.find((item) => item.slug === slug);
}

export function listDecisions(catalog: FixtureCatalog): Decision[] {
  return catalog.decisions;
}

export function getDecisionBundle(catalog: FixtureCatalog, slug: string) {
  const decision = getDecisionBySlug(catalog, slug);
  if (!decision) {
    return undefined;
  }
  const topic = getTopicById(catalog, decision.topicId);
  const deliberation = catalog.deliberations.find(
    (item) => item.id === decision.deliberationId,
  );
  const agendaItem = deliberation
    ? catalog.agendaItems.find((item) => item.id === deliberation.agendaItemId)
    : undefined;
  const finalProposal = catalog.proposals.find(
    (item) => item.id === decision.finalProposalId,
  );
  const proposalHistory = decision.proposalVersionIds
    .map((id) => catalog.proposals.find((item) => item.id === id))
    .filter((item) => item != null);
  const participantsById = new Map(
    catalog.councilParticipants.map((item) => [item.id, item]),
  );
  const rollCall = decision.rollCall.map((entry) => ({
    ...entry,
    participant: participantsById.get(entry.participantId),
  }));
  const minorityAuthors = decision.minorityReport.authorParticipantIds
    .map((id) => participantsById.get(id))
    .filter((item) => item != null);

  if (!topic || !deliberation || !finalProposal) {
    return undefined;
  }

  return {
    decision,
    topic,
    deliberation,
    agendaItem,
    finalProposal,
    proposalHistory,
    rollCall,
    minorityAuthors,
  };
}

export function listAuditEvents(catalog: FixtureCatalog) {
  return [...catalog.auditEvents].sort((a, b) => a.at.localeCompare(b.at));
}

export function getConsultationResultForTopic(
  catalog: FixtureCatalog,
  topicId: string,
): ConsultationResult | undefined {
  return catalog.consultationResults.find((item) => item.topicId === topicId);
}

export function getClaimsForTopic(catalog: FixtureCatalog, topicId: string) {
  return catalog.claims.filter((claim) => claim.topicId === topicId);
}

export function getEvidenceForTopic(catalog: FixtureCatalog, topicId: string) {
  return catalog.evidenceSources.filter((source) => source.topicId === topicId);
}

export function getScenarioBundle(catalog: FixtureCatalog, topicSlug: string) {
  const topic = getTopicBySlug(catalog, topicSlug);
  if (!topic) {
    return undefined;
  }

  return {
    topic,
    claims: getClaimsForTopic(catalog, topic.id),
    evidenceSources: getEvidenceForTopic(catalog, topic.id),
    consultationResult: getConsultationResultForTopic(catalog, topic.id),
    consultationStatements: catalog.consultationStatements.filter(
      (statement) => statement.topicId === topic.id,
    ),
    agendaItem: getPrimaryAgendaItemForTopic(catalog, topic.id),
    agendaItems: getAgendaItemsForTopic(catalog, topic.id),
    deliberation: catalog.deliberations.find((item) => item.topicId === topic.id),
    decision: catalog.decisions.find((item) => item.topicId === topic.id),
  };
}
