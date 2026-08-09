import { EvidenceSourceCard } from "@/features/topics/EvidenceSourceCard";
import type { Claim, EvidenceSource } from "@/domain/types";

type ClaimCardProps = {
  claim: Claim;
  supporting: EvidenceSource[];
  counterevidence: EvidenceSource[];
};

export function ClaimCard({ claim, supporting, counterevidence }: ClaimCardProps) {
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
                  relationLabel="Counterevidence"
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
    </article>
  );
}
