export const TOPIC_SECTIONS = ["overview", "evidence", "discussions"] as const;
export type TopicSection = (typeof TOPIC_SECTIONS)[number];

export const TOPIC_SECTION_LABELS: Record<TopicSection, string> = {
  overview: "Overview",
  evidence: "Evidence",
  discussions: "Discussions & Proposals",
};

const MAX_SECTION_PARAM_LENGTH = 32;

/**
 * Parse allowlisted `section` query value. Unknown/malformed/overlong → overview.
 */
export function parseTopicSection(raw: string | string[] | undefined): TopicSection {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || value === "") {
    return "overview";
  }
  if (value.length > MAX_SECTION_PARAM_LENGTH) {
    return "overview";
  }
  if ((TOPIC_SECTIONS as readonly string[]).includes(value)) {
    return value as TopicSection;
  }
  return "overview";
}

export function topicSectionHref(slug: string, section: TopicSection): string {
  if (section === "overview") {
    return `/formal-topics/${slug}`;
  }
  return `/formal-topics/${slug}?section=${section}`;
}

/** Normalize legacy `view=public-input-report` to overview + hash. */
export function normalizeLegacyTopicView(
  view: string | string[] | undefined,
): { section: TopicSection; hash: string | null } {
  const value = Array.isArray(view) ? view[0] : view;
  if (value === "public-input-report") {
    return { section: "overview", hash: "public-input-report" };
  }
  return { section: "overview", hash: null };
}
