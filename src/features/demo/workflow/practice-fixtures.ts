/**
 * Fixed synthetic fixtures for `/demo/workflow` practice journeys.
 * Deterministic content only — not live participants or gated intake.
 */

export const PRACTICE_TOPIC_IDEAS = [
  {
    id: "idea-school-bus-electrification",
    title: "School bus electrification timelines",
    blurb:
      "Whether Tennessee school districts should publish phased electrification plans for pupil transportation fleets.",
  },
  {
    id: "idea-broadband-mapping",
    title: "Rural broadband mapping accuracy",
    blurb:
      "How public broadband availability maps should be challenged when households report no workable service.",
  },
] as const;

export const PRACTICE_REASONS = [
  {
    id: "reason-public-cost",
    label: "Public cost and budget transparency",
  },
  {
    id: "reason-service-access",
    label: "Uneven access to essential services",
  },
  {
    id: "reason-evidence-gap",
    label: "Published evidence appears incomplete or contested",
  },
] as const;

export const PRACTICE_STARTING_SOURCES = [
  {
    id: "source-none",
    label: "No starting source (optional)",
    url: null as string | null,
  },
  {
    id: "source-tn-comptroller",
    label: "Synthetic Comptroller briefing excerpt",
    url: "https://www.tn.gov/example/comptroller-briefing",
  },
  {
    id: "source-university-memo",
    label: "Synthetic university policy memo",
    url: "https://www.example.edu/tennessee-policy-memo",
  },
] as const;

export const PRACTICE_OPEN_TOPICS = [
  {
    id: "topic-cedar-river-drought-surcharge",
    title: "Cedar River drought surcharge (synthetic)",
    blurb:
      "Open synthetic topic used to practice contributing a source with limitations and conflict disclosure.",
  },
  {
    id: "topic-nashville-transit-fare",
    title: "Nashville transit fare equity (synthetic)",
    blurb:
      "Second open synthetic topic for practicing supporting or counterevidence contributions.",
  },
] as const;

export const PRACTICE_SOURCE_OPTIONS = [
  {
    id: "safe-agency-report",
    kind: "safe" as const,
    label: "Safe agency report (https)",
    url: "https://www.tn.gov/example/drought-surcharge-report",
  },
  {
    id: "safe-research-brief",
    kind: "safe" as const,
    label: "Safe research brief (https)",
    url: "https://www.example.org/tennessee/research-brief",
  },
  {
    id: "unsafe-http",
    kind: "unsafe" as const,
    label: "Unsafe example: http scheme",
    url: "http://www.example.com/insecure",
    category: "scheme" as const,
  },
  {
    id: "unsafe-private-ip",
    kind: "unsafe" as const,
    label: "Unsafe example: private network address",
    url: "https://192.168.1.10/report",
    category: "host_private" as const,
  },
  {
    id: "unsafe-javascript",
    kind: "unsafe" as const,
    label: "Unsafe example: javascript scheme",
    url: "javascript:alert(1)",
    category: "scheme" as const,
  },
  {
    id: "unsafe-localhost",
    kind: "unsafe" as const,
    label: "Unsafe example: localhost",
    url: "https://localhost/secret",
    category: "host_local" as const,
  },
] as const;

export const PRACTICE_LIMITATIONS = [
  {
    id: "limit-sample-size",
    label: "Small sample; may not generalize statewide",
  },
  {
    id: "limit-time-bound",
    label: "Data covers a short time window only",
  },
  {
    id: "limit-funding",
    label: "Source organization receives related program funding",
  },
] as const;

export const PRACTICE_DISCLOSURES = [
  {
    id: "disclosure-none",
    choice: "none" as const,
    label: "No known conflict of interest",
    publicSummary: "No known conflict of interest to disclose.",
  },
  {
    id: "disclosure-employer",
    choice: "disclose" as const,
    label: "Employer works on related contracts (synthetic)",
    publicSummary:
      "Example participant notes an employer that bids on related public contracts.",
  },
] as const;

export type PracticeTopicIdeaId = (typeof PRACTICE_TOPIC_IDEAS)[number]["id"];
export type PracticeReasonId = (typeof PRACTICE_REASONS)[number]["id"];
export type PracticeStartingSourceId =
  (typeof PRACTICE_STARTING_SOURCES)[number]["id"];
export type PracticeOpenTopicId = (typeof PRACTICE_OPEN_TOPICS)[number]["id"];
export type PracticeSourceOptionId =
  (typeof PRACTICE_SOURCE_OPTIONS)[number]["id"];
export type PracticeLimitationsId = (typeof PRACTICE_LIMITATIONS)[number]["id"];
export type PracticeDisclosureId = (typeof PRACTICE_DISCLOSURES)[number]["id"];

export function findTopicIdea(id: string | null) {
  return PRACTICE_TOPIC_IDEAS.find((item) => item.id === id) ?? null;
}

export function findReason(id: string | null) {
  return PRACTICE_REASONS.find((item) => item.id === id) ?? null;
}

export function findStartingSource(id: string | null) {
  return PRACTICE_STARTING_SOURCES.find((item) => item.id === id) ?? null;
}

export function findOpenTopic(id: string | null) {
  return PRACTICE_OPEN_TOPICS.find((item) => item.id === id) ?? null;
}

export function findSourceOption(id: string | null) {
  return PRACTICE_SOURCE_OPTIONS.find((item) => item.id === id) ?? null;
}

export function findLimitations(id: string | null) {
  return PRACTICE_LIMITATIONS.find((item) => item.id === id) ?? null;
}

export function findDisclosure(id: string | null) {
  return PRACTICE_DISCLOSURES.find((item) => item.id === id) ?? null;
}
