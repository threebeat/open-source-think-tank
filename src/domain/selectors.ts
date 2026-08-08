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

export function getDeliberationBySlug(
  catalog: FixtureCatalog,
  slug: string,
): Deliberation | undefined {
  return catalog.deliberations.find((item) => item.slug === slug);
}

export function getDecisionBySlug(
  catalog: FixtureCatalog,
  slug: string,
): Decision | undefined {
  return catalog.decisions.find((item) => item.slug === slug);
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
    agendaItem: catalog.agendaItems.find((item) => item.topicId === topic.id),
    deliberation: catalog.deliberations.find((item) => item.topicId === topic.id),
    decision: catalog.decisions.find((item) => item.topicId === topic.id),
  };
}
