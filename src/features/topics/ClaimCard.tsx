import {
  EvidenceComparison,
  type ComparableEvidenceItem,
} from "@/components/topics/EvidenceComparison";
import { EvidenceSourceCard } from "@/features/topics/EvidenceSourceCard";
import type { Claim, EvidenceSource } from "@/domain/types";
import { evidenceReviewExplanations } from "@/lib/evidence-labels";

type ClaimCardProps = {
  claim: Claim;
  supporting: EvidenceSource[];
  counterevidence: EvidenceSource[];
};

/**
 * Public-demo fixture claim card. Uses the shared comparison presentation with
 * fixture DTOs only — never imports gated revision/review services.
 */
export function ClaimCard({ claim, supporting, counterevidence }: ClaimCardProps) {
  const comparable: ComparableEvidenceItem[] = [
    ...supporting.map((source) => ({
      key: source.id,
      relationship: "supporting" as const,
      title: source.title,
      organization: source.organization,
      authorType: source.authorType,
      sourceType: source.sourceType,
      limitations: source.limitations,
      qualityStatus: source.reviewStatus,
      qualityPlainLanguage: evidenceReviewExplanations[source.reviewStatus],
      qualityPublicRationale: null,
      workflowPublicRationale: null,
      sourceUrl: null,
    })),
    ...counterevidence.map((source) => ({
      key: source.id,
      relationship: "counterevidence" as const,
      title: source.title,
      organization: source.organization,
      authorType: source.authorType,
      sourceType: source.sourceType,
      limitations: source.limitations,
      qualityStatus: source.reviewStatus,
      qualityPlainLanguage: evidenceReviewExplanations[source.reviewStatus],
      qualityPublicRationale: null,
      workflowPublicRationale: null,
      sourceUrl: null,
    })),
  ];

  return (
    <article
      id={claim.id}
      className="scroll-mt-28 rounded-md border border-border bg-surface p-5 sm:p-6"
    >
      <p className="text-xs font-medium tracking-wide text-primary uppercase">
        {claim.approachLabel}
      </p>
      <h3 className="mt-2 font-heading text-xl text-foreground">{claim.title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{claim.summary}</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby={`${claim.id}-supporting`}>
          <h4
            id={`${claim.id}-supporting`}
            className="text-sm font-medium text-foreground"
          >
            Supporting evidence
          </h4>
          <div className="mt-3 space-y-3">
            {supporting.length > 0 ? (
              supporting.map((source) => (
                <EvidenceSourceCard
                  key={source.id}
                  source={source}
                  relationLabel="Supporting"
                  anchor={false}
                />
              ))
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                No supporting sources attached yet.
              </p>
            )}
          </div>
        </section>
        <section aria-labelledby={`${claim.id}-counter`}>
          <h4
            id={`${claim.id}-counter`}
            className="text-sm font-medium text-foreground"
          >
            Counterevidence
          </h4>
          <div className="mt-3 space-y-3">
            {counterevidence.length > 0 ? (
              counterevidence.map((source) => (
                <EvidenceSourceCard
                  key={source.id}
                  source={source}
                  relationLabel="Evidence Against This Claim"
                  anchor={false}
                />
              ))
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                No counterevidence attached yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-5">
        <EvidenceComparison claimTitle={claim.title} items={comparable} />
      </div>
    </article>
  );
}
