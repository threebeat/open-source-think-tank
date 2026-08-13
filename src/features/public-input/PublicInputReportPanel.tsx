import { DisclosureNotice } from "@/components/DisclosureNotice";
import {
  formatOpinionGroupShare,
  type PublicInputPublicDto,
} from "@/features/public-input/aggregate-report";

type Props = {
  report: PublicInputPublicDto;
};

export function PublicInputReportPanel({ report }: Props) {
  return (
    <section className="space-y-4" aria-labelledby="public-input-report-heading">
      <h2
        id="public-input-report-heading"
        className="font-heading text-2xl text-foreground"
      >
        Anonymous aggregate Public Input report
      </h2>
      <DisclosureNotice title="Aggregates only — Pol.is is an input" tone="caution">
        {report.providerNotice} This report does not expose provider participant
        IDs, account IDs, per-person vote rows, individual group membership,
        cross-conversation linkage, contact/identity/verification data, or
        secret-bearing provider URLs.
      </DisclosureNotice>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-medium">Total participation</dt>
          <dd className="mt-1 text-2xl font-heading text-foreground">
            {report.participationCount.toLocaleString("en-US")}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium">Comment total</dt>
          <dd className="mt-1 text-2xl font-heading text-foreground">
            {report.commentTotal.toLocaleString("en-US")}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium">Vote total</dt>
          <dd className="mt-1 text-2xl font-heading text-foreground">
            {report.voteTotal.toLocaleString("en-US")}
          </dd>
        </div>
      </dl>
      <div>
        <h3 className="font-heading text-lg text-foreground">
          Neutrally named aggregate opinion groups
        </h3>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {report.opinionGroups.map((group) => (
            <li key={group.label}>
              {group.label}: {formatOpinionGroupShare(group)}
              {group.status === "suppressed" ? (
                <span className="sr-only">
                  {" "}
                  (privacy-suppressed; not a zero share)
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="font-heading text-lg text-foreground">
            Cross-group agreement
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {report.crossGroupAgreement.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-heading text-lg text-foreground">
            Meaningful disagreement
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {report.meaningfulDisagreement.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Participation sufficiency: </span>
        {report.participationSufficiency}
      </p>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Representation limitations: </span>
        {report.representationLimitations}
      </p>
      <p className="text-sm text-muted-foreground">
        Method {report.methodVersion} · imported {report.importTimestamp}
      </p>
      <p className="text-sm text-muted-foreground">
        {report.smallCellSuppressionNotice} Suppressed cells in this projection:{" "}
        {report.suppressedCells}.
      </p>
    </section>
  );
}
