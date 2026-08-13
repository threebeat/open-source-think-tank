import type { CanonicalTopicViewModel } from "@/features/formal-topics/canonical-topic-model";
import { getGatedDb } from "@/lib/auth/runtime";
import { getPublishedTopicProjection } from "@/lib/topics/gated-public-read";

export type GatedCanonicalTopicLoad =
  | { status: "ok"; model: CanonicalTopicViewModel }
  | { status: "not_found" }
  | { status: "unavailable" };

/**
 * Gated loader — published allowlisted PostgreSQL projection only.
 * Never falls back to synthetic formal-topic fixtures.
 */
export async function loadGatedCanonicalTopic(
  slug: string,
): Promise<GatedCanonicalTopicLoad> {
  const result = await getPublishedTopicProjection(getGatedDb(), slug);
  if (!result.ok) {
    return { status: "unavailable" };
  }
  if (!result.value) {
    return { status: "not_found" };
  }

  const projection = result.value;
  const accepted = projection.evidence.filter(
    (e) => e.qualityStatus === "accepted",
  ).length;
  const limited = projection.evidence.filter(
    (e) => e.qualityStatus === "limited",
  ).length;
  const disputed = projection.evidence.filter(
    (e) => e.qualityStatus === "disputed",
  ).length;

  return {
    status: "ok",
    model: {
      lane: "gated",
      slug: projection.slug,
      title: projection.title,
      question: projection.question,
      introduction: projection.background.slice(0, 280),
      stageLabel: projection.operationalLabel,
      jurisdictionLabel:
        projection.geography.jurisdictionLevel === "statewide"
          ? `Statewide · ${projection.geography.stateCode}`
          : `County · ${projection.geography.stateCode}`,
      disclosure:
        "Gated alpha published topic. Public Input live provider remains fail-closed in Phase 4.3.",
      lastPublicUpdate: projection.publishedAt,
      advancingState: "advancing",
      whoCanActNow:
        "Authorized participants may contribute through gated workspace surfaces when the topic workflow allows. Preference totals cannot replace evidence or process requirements.",
      nextTransition:
        "Follow the published operational label and workspace workflow. Live Public Input embed remains blocked until every activation gate is cleared.",
      unmetCriteria: [],
      criteriaMet: ["Published allowlisted projection available"],
      evidenceSummary: {
        totalPublic: projection.evidence.length,
        accepted,
        limited,
        disputed,
        pending: 0,
        rejected: 0,
        readinessLabel:
          projection.evidence.length === 0
            ? "No publication-eligible evidence"
            : "Publication-eligible evidence listed in Evidence",
        importantGap:
          projection.evidence.length === 0
            ? "No sources are currently publication-eligible."
            : "Review full inventory in Evidence for limitations and conflicts.",
      },
      claims: [],
      evidence: [],
      gatedProjection: projection,
      discussions: [],
      discussionsUnavailableReason:
        "Public discussion/proposal relationships are not yet operational in the gated schema. No synthetic relationships are shown for gated publications.",
      publicInputReport: null,
      qualificationTrace: null,
      gate: null,
      topic: null,
    },
  };
}
