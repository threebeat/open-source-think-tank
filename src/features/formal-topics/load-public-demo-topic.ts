import { getScenarioBundle } from "@/domain/selectors";
import { listPublicDemoDiscussionRelationships } from "@/features/formal-topics/discussion-relationships";
import type { CanonicalTopicViewModel } from "@/features/formal-topics/canonical-topic-model";
import type { EvidenceSummaryCounts } from "@/features/formal-topics/canonical-topic-model";
import { getPublicInputPublicDto } from "@/features/public-input/aggregate-report";
import { fixtureCatalog } from "@/fixtures";
import {
  formalTopicGateViews,
  qualificationTraces,
} from "@/fixtures/journey-catalog";

function summarizeEvidence(
  evidence: { reviewStatus: string }[],
  gateUnmet: string[],
): EvidenceSummaryCounts {
  const accepted = evidence.filter((e) => e.reviewStatus === "accepted").length;
  const limited = evidence.filter((e) => e.reviewStatus === "limited").length;
  const disputed = evidence.filter((e) => e.reviewStatus === "disputed").length;
  const pending = evidence.filter((e) => e.reviewStatus === "pending").length;
  const rejected = evidence.filter((e) => e.reviewStatus === "rejected").length;
  const totalPublic = evidence.length;
  const readinessLabel =
    pending > 0 || disputed > 0
      ? "Attention — some sources pending or disputed"
      : accepted + limited >= 3
        ? "Enough research to support the current stage"
        : "Not enough research yet";
  const importantGap =
    gateUnmet.find((item) => /evidence|estimate|research/i.test(item)) ??
    (pending > 0
      ? "At least one linked source is still pending review."
      : "No outstanding evidence gap named in the synthetic gate view.");
  return {
    totalPublic,
    accepted,
    limited,
    disputed,
    pending,
    rejected,
    readinessLabel,
    importantGap,
  };
}

/**
 * Public-demo loader — fixture projections only.
 * Must never import gated DB/auth/provider modules.
 */
export function loadPublicDemoCanonicalTopic(
  slug: string,
): CanonicalTopicViewModel | null {
  const gate =
    formalTopicGateViews.find((item) => item.topicSlug === slug) ?? null;

  // Deferred billing ops shares the parent Cedar River scenario bundle.
  const scenarioSlug =
    slug === "cedar-river-billing-ops-gap"
      ? "cedar-river-drought-surcharge"
      : slug;
  const bundle = getScenarioBundle(fixtureCatalog, scenarioSlug);
  if (!bundle && !gate) {
    return null;
  }

  const topic = bundle?.topic ?? null;
  const claims = bundle?.claims ?? [];
  const evidence = bundle?.evidenceSources ?? [];
  const unmet = gate?.criteriaUnmet ?? [];
  const advancingState =
    gate?.currentStage === "decision" || topic?.stage === "decision"
      ? "complete"
      : slug.includes("billing-ops")
        ? "deferred"
        : "advancing";

  const title =
    slug === "cedar-river-billing-ops-gap"
      ? "Cedar River billing-operations readiness (deferred)"
      : (topic?.title ?? gate?.topicSlug ?? slug);
  const question =
    slug === "cedar-river-billing-ops-gap"
      ? "Should billing-system change-cost readiness qualify as a separate agenda item before deliberation?"
      : (topic?.question ?? gate?.originSummary ?? "");

  return {
    lane: "public-demo",
    slug,
    title,
    question,
    introduction:
      topic?.background.slice(0, 280) ??
      "Synthetic formal topic demonstration.",
    stageLabel: gate?.currentStage ?? topic?.stage ?? "unknown",
    jurisdictionLabel: topic
      ? `${topic.jurisdictionLevel === "statewide" ? "Statewide" : "County"} · ${topic.stateCode}`
      : "Synthetic jurisdiction",
    disclosure:
      "Public-demo synthetic topic. Not a gated publication and not connected to Pol.is.",
    lastPublicUpdate: topic?.changelog.at(-1)?.at ?? gate?.lineage.at(-1)?.at ?? null,
    advancingState,
    whoCanActNow:
      gate?.whoCanActNow ??
      "Visitors may inspect public records. No elevated role may privately promote pre-deliberation topics.",
    nextTransition:
      gate?.nextTransition ?? topic?.nextStep ?? "Continue the synthetic journey.",
    unmetCriteria: unmet,
    criteriaMet: gate?.criteriaMet ?? [],
    evidenceSummary: summarizeEvidence(evidence, unmet),
    claims,
    evidence,
    gatedProjection: null,
    discussions: listPublicDemoDiscussionRelationships(slug),
    discussionsUnavailableReason: null,
    publicInputReport: getPublicInputPublicDto(
      slug === "cedar-river-billing-ops-gap"
        ? "cedar-river-drought-surcharge"
        : slug,
    ),
    qualificationTrace:
      qualificationTraces.find((item) => item.topicSlug === slug) ?? null,
    gate,
    topic,
  };
}
