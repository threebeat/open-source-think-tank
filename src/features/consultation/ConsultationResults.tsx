import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { MetricWithExplanation } from "@/components/MetricWithExplanation";
import type {
  Claim,
  ConsultationResult,
  ConsultationStatement,
  EvidenceSource,
  OpinionGroup,
} from "@/domain/types";

type ConsultationResultsProps = {
  topicSlug: string;
  result: ConsultationResult;
  statements: ConsultationStatement[];
  groups: OpinionGroup[];
  claimsById: Map<string, Claim>;
  evidenceById: Map<string, EvidenceSource>;
};

function StatementListItem({
  statement,
  topicSlug,
  claimsById,
  evidenceById,
  metricLabel,
}: {
  statement: ConsultationStatement;
  topicSlug: string;
  claimsById: Map<string, Claim>;
  evidenceById: Map<string, EvidenceSource>;
  metricLabel?: string;
}) {
  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <p className="text-sm leading-6 text-foreground">{statement.text}</p>
      {metricLabel ? (
        <p className="mt-2 text-xs text-muted-foreground">{metricLabel}</p>
      ) : null}
      {(statement.isPopularWeakEvidence ||
        statement.isLessPopularStrongEvidence) && (
        <p className="mt-2 text-xs font-medium text-foreground">
          {statement.isPopularWeakEvidence
            ? "Popular in the synthetic report, but linked evidence is weak or rejected."
            : "Less popular in the synthetic report, but linked evidence is stronger."}
        </p>
      )}
      <ul className="mt-3 flex flex-wrap gap-2 text-xs">
        {statement.relatedClaimIds.map((claimId) => {
          const claim = claimsById.get(claimId);
          if (!claim) {
            return null;
          }
          return (
            <li key={claimId}>
              <Link
                href={`/topics/${topicSlug}#${claim.id}`}
                className="inline-flex min-h-11 items-center rounded-md bg-muted px-2 text-foreground underline-offset-4 hover:underline"
              >
                Claim: {claim.title}
              </Link>
            </li>
          );
        })}
        {statement.relatedEvidenceIds.map((evidenceId) => {
          const evidence = evidenceById.get(evidenceId);
          if (!evidence) {
            return null;
          }
          return (
            <li key={evidenceId}>
              <Link
                href={`/topics/${topicSlug}`}
                className="inline-flex min-h-11 items-center rounded-md bg-muted px-2 text-foreground underline-offset-4 hover:underline"
              >
                Evidence ({evidence.reviewStatus}): {evidence.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export function ConsultationResults({
  topicSlug,
  result,
  statements,
  groups,
  claimsById,
  evidenceById,
}: ConsultationResultsProps) {
  const byId = new Map(statements.map((statement) => [statement.id, statement]));
  const metricsById = new Map(
    result.statementMetrics.map((metric) => [metric.statementId, metric]),
  );

  const consensus = result.consensusStatementIds
    .map((id) => byId.get(id))
    .filter((item): item is ConsultationStatement => item != null);
  const disagreement = result.highDisagreementStatementIds
    .map((id) => byId.get(id))
    .filter((item): item is ConsultationStatement => item != null);

  return (
    <section
      className="space-y-6"
      aria-labelledby="consult-report-heading"
      role="region"
    >
      <div>
        <h2
          id="consult-report-heading"
          className="font-heading text-2xl text-foreground"
        >
          Fixed synthetic consultation report
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          This report is a sealed fixture snapshot ({result.methodVersion}). Your
          local practice votes do not change these numbers or rearrange the
          content.
        </p>
      </div>

      <DisclosureNotice title="Not a representative sample" tone="caution">
        {result.notRepresentativeNotice} Neutrally labeled groups (for example,{" "}
        {groups.map((group) => group.label).join(", ")}) are not ideology labels
        and do not imply a population mandate.
      </DisclosureNotice>

      <DisclosureNotice title="Consensus is not proof">
        Cross-group agreement organizes preference. It is not evidence that a
        claim is true. Disagreement is not evidence of equal factual support.
        Evidence-review status stays separate on the topic page.
      </DisclosureNotice>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricWithExplanation
          label="Participation count"
          value={String(result.participationCount)}
          explanation="Synthetic participants in the sealed snapshot."
        />
        <MetricWithExplanation
          label="Response coverage"
          value={`${Math.round(result.responseCoverage * 100)}%`}
          explanation="Average share of statements answered in the synthetic cohort."
        />
        <MetricWithExplanation
          label="Opinion groups"
          value={groups.map((group) => group.label).join(", ")}
          explanation="Neutral labels only. No liberal/conservative or other ideology tags."
        />
      </div>

      <section className="space-y-3">
        <h3 className="font-heading text-xl text-foreground">
          Cross-group consensus statements
        </h3>
        <ul className="space-y-3">
          {consensus.map((statement) => {
            const metric = metricsById.get(statement.id);
            return (
              <StatementListItem
                key={statement.id}
                statement={statement}
                topicSlug={topicSlug}
                claimsById={claimsById}
                evidenceById={evidenceById}
                metricLabel={
                  metric
                    ? `Synthetic agree share: ${Math.round(metric.agreeShare * 100)}%`
                    : undefined
                }
              />
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-heading text-xl text-foreground">
          High-disagreement statements
        </h3>
        <ul className="space-y-3">
          {disagreement.map((statement) => {
            const metric = metricsById.get(statement.id);
            const groupParts = metric
              ? groups
                  .map((group) => {
                    const share = metric.groupAgreeShares[group.id];
                    return share == null
                      ? null
                      : `${group.label} ${Math.round(share * 100)}%`;
                  })
                  .filter((part): part is string => part != null)
                  .join(" · ")
              : undefined;
            return (
              <StatementListItem
                key={statement.id}
                statement={statement}
                topicSlug={topicSlug}
                claimsById={claimsById}
                evidenceById={evidenceById}
                metricLabel={groupParts}
              />
            );
          })}
        </ul>
      </section>
    </section>
  );
}
