import Link from "next/link";

import type {
  Claim,
  ConsultationStatement,
  EvidenceSource,
} from "@/domain/types";

type SourceLinksProps = {
  topicSlug: string;
  evidence: EvidenceSource[];
  statements?: ConsultationStatement[];
  claims?: Claim[];
  emptyLabel?: string;
};

export function SourceLinks({
  topicSlug,
  evidence,
  statements = [],
  claims = [],
  emptyLabel = "No linked sources in the fixture.",
}: SourceLinksProps) {
  if (evidence.length === 0 && statements.length === 0 && claims.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {claims.map((claim) => (
        <li key={claim.id}>
          <Link
            href={`/topics/${topicSlug}#${claim.id}`}
            className="inline-flex min-h-11 items-center rounded-md bg-muted px-2 text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Claim: {claim.title}
          </Link>
        </li>
      ))}
      {evidence.map((source) => (
        <li key={source.id}>
          <Link
            href={`/topics/${topicSlug}#${source.id}`}
            className="inline-flex min-h-11 items-center rounded-md bg-muted px-2 text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Evidence ({source.reviewStatus}): {source.title}
          </Link>
        </li>
      ))}
      {statements.map((statement) => (
        <li key={statement.id}>
          <Link
            href={`/topics/${topicSlug}/consult#${statement.id}`}
            className="inline-flex min-h-11 items-center rounded-md bg-muted px-2 text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Consultation statement: {statement.text}
          </Link>
        </li>
      ))}
    </ul>
  );
}
