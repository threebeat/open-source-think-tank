import { DisclosureNotice } from "@/components/DisclosureNotice";
import { MetricWithExplanation } from "@/components/MetricWithExplanation";
import { StatementRelationships } from "@/features/consultation/StatementRelationships";
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
  anchor = false,
}: {
  statement: ConsultationStatement;
  topicSlug: string;
  claimsById: Map<string, Claim>;
  evidenceById: Map<string, EvidenceSource>;
  metricLabel?: string;
  anchor?: boolean;
}) {
  return (
    <li
      id={anchor ? statement.id : undefined}
      className="scroll-mt-28 rounded-md border border-border bg-surface p-4"
    >
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
      <div className="mt-3">
        <StatementRelationships
          statement={statement}
          topicSlug={topicSlug}
          claimsById={claimsById}
          evidenceById={evidenceById}
        />
      </div>
    </li>
  );
}

function metricLabelFor(
  statement: ConsultationStatement,
  metricsById: Map<string, ConsultationResult["statementMetrics"][number]>,
  groups: OpinionGroup[],
): string | undefined {
  const metric = metricsById.get(statement.id);
  if (!metric) {
    return undefined;
  }
  if (statement.isHighDisagreement) {
    return groups
      .map((group) => {
        const share = metric.groupAgreeShares[group.id];
        return share == null
          ? null
          : `${group.label} ${Math.round(share * 100)}%`;
      })
      .filter((part): part is string => part != null)
      .join(" · ");
  }
  return `Share who agreed in this demonstration: ${Math.round(metric.agreeShare * 100)}%`;
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
          Sample Public Input Report
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          This is a demonstration report ({result.methodVersion}) — not a live
          Public Input session. A later alpha phase is planned to use Pol.is for
          live Public Input from eligible/invited participants. Your local
          practice votes do not change these numbers or rearrange the content.
        </p>
      </div>

      <DisclosureNotice title="Not a representative sample" tone="caution">
        {result.notRepresentativeNotice} Neutrally labeled groups (for example,{" "}
        {groups.map((group) => group.label).join(", ")}) are not ideology labels
        and do not imply a population mandate. This demonstration does not
        connect to Pol.is and does not offer unrestricted public
        self-registration.
      </DisclosureNotice>

      <DisclosureNotice title="Agreement is not proof">
        Areas of agreement and disagreement organize preference. They are not
        evidence that a claim is true, and they do not set research review
        status. Research quality stays separate on the topic page.
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
          label="Areas of Agreement and Disagreement"
          value={groups.map((group) => group.label).join(", ")}
          explanation="Neutral labels only. No liberal/conservative or other ideology tags."
        />
      </div>

      <section className="space-y-3">
        <h3 className="font-heading text-xl text-foreground">
          Statements people agreed on across groups
        </h3>
        <ul className="space-y-3">
          {consensus.map((statement) => (
            <StatementListItem
              key={statement.id}
              statement={statement}
              topicSlug={topicSlug}
              claimsById={claimsById}
              evidenceById={evidenceById}
              metricLabel={metricLabelFor(statement, metricsById, groups)}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-heading text-xl text-foreground">
          Statements with the most disagreement
        </h3>
        <ul className="space-y-3">
          {disagreement.map((statement) => (
            <StatementListItem
              key={statement.id}
              statement={statement}
              topicSlug={topicSlug}
              claimsById={claimsById}
              evidenceById={evidenceById}
              metricLabel={metricLabelFor(statement, metricsById, groups)}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="all-statements-heading">
        <h3
          id="all-statements-heading"
          className="font-heading text-xl text-foreground"
        >
          All statements and evidence links
        </h3>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Every statement in the sealed snapshot, including popular/weak-evidence
          and less-popular/strong-evidence examples. Consensus highlights above do
          not hide the rest of the record.
        </p>
        <ul className="space-y-3">
          {statements.map((statement) => (
            <StatementListItem
              key={statement.id}
              statement={statement}
              topicSlug={topicSlug}
              claimsById={claimsById}
              evidenceById={evidenceById}
              metricLabel={metricLabelFor(statement, metricsById, groups)}
              anchor
            />
          ))}
        </ul>
      </section>
    </section>
  );
}
