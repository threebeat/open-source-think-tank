import {
  EvidenceComparison,
  type ComparableEvidenceItem,
} from "@/components/topics/EvidenceComparison";
import type { Claim, EvidenceSource } from "@/domain/types";
import { evidenceReviewExplanations, evidenceReviewLabels } from "@/lib/evidence-labels";

type ClaimCardProps = {
  claim: Claim;
  supporting: EvidenceSource[];
  counterevidence: EvidenceSource[];
};

/**
 * Public-demo fixture claim card.
 * Shows compact evidence references (counts + titles) rather than duplicating
 * full source cards — the Evidence inventory is the canonical detail surface.
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
        <CompactEvidenceList
          headingId={`${claim.id}-supporting`}
          heading="Supporting evidence"
          empty="No supporting sources attached yet."
          sources={supporting}
          relationship="Supporting"
        />
        <CompactEvidenceList
          headingId={`${claim.id}-counter`}
          heading="Counterevidence"
          empty="No counterevidence attached yet."
          sources={counterevidence}
          relationship="Evidence Against This Claim"
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Full source details, limitations, and conflict disclosures live in the
        evidence inventory below. Use “View evidence details and source” there.
      </p>

      <div className="mt-5">
        <EvidenceComparison claimTitle={claim.title} items={comparable} />
      </div>
    </article>
  );
}

function CompactEvidenceList({
  headingId,
  heading,
  empty,
  sources,
  relationship,
}: {
  headingId: string;
  heading: string;
  empty: string;
  sources: EvidenceSource[];
  relationship: string;
}) {
  return (
    <section aria-labelledby={headingId}>
      <h4 id={headingId} className="text-sm font-medium text-foreground">
        {heading}
        <span className="ml-2 font-normal text-muted-foreground">
          ({sources.length})
        </span>
      </h4>
      <div className="mt-3 space-y-2">
        {sources.length > 0 ? (
          <ul className="space-y-2">
            {sources.map((source) => (
              <li key={source.id}>
                <a
                  href={`#${source.id}`}
                  className="block rounded-md border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-medium text-foreground">{source.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {relationship} · Review:{" "}
                    {evidenceReviewLabels[source.reviewStatus]} ·{" "}
                    {source.organization}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}
