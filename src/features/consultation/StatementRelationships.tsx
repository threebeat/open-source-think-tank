import Link from "next/link";

import type {
  Claim,
  ConsultationStatement,
  EvidenceSource,
} from "@/domain/types";

type StatementRelationshipsProps = {
  statement: ConsultationStatement;
  topicSlug: string;
  claimsById: Map<string, Claim>;
  evidenceById: Map<string, EvidenceSource>;
};

export function StatementRelationships({
  statement,
  topicSlug,
  claimsById,
  evidenceById,
}: StatementRelationshipsProps) {
  const claims = statement.relatedClaimIds
    .map((id) => claimsById.get(id))
    .filter((claim): claim is Claim => claim != null);
  const evidence = statement.relatedEvidenceIds
    .map((id) => evidenceById.get(id))
    .filter((source): source is EvidenceSource => source != null);

  if (claims.length === 0 && evidence.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No related claims or evidence linked to this statement in the fixture.
      </p>
    );
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
    </ul>
  );
}
