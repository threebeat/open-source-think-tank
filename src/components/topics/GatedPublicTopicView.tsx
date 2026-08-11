import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { formatTopicGeography } from "@/lib/geography/tennessee-counties";
import type { PublicTopicProjection } from "@/lib/topics/public-projection";

function geographyLabel(geography: PublicTopicProjection["geography"]): string {
  return formatTopicGeography({
    jurisdictionLevel: geography.jurisdictionLevel,
    stateCode: "TN",
    countyFips: geography.countyFips,
  });
}

function qualityPlainLanguage(
  status: "accepted" | "limited" | "disputed" | "rejected",
): string {
  switch (status) {
    case "accepted":
      return "Accepted quality means reviewers found the source usable for this alpha publication. It does not prove a claim is true.";
    case "limited":
      return "Limited quality means the source is useful with clear constraints. It does not prove a claim is true.";
    case "disputed":
      return "Disputed quality means reviewers recorded contested source fitness. It does not prove a claim is true or false.";
    case "rejected":
      return "Rejected quality means reviewers did not accept the source for this publication. It does not settle claim truth.";
  }
}

type GatedPublicTopicViewProps = {
  projection: PublicTopicProjection;
};

export function GatedPublicTopicView({ projection }: GatedPublicTopicViewProps) {
  const evidenceByKey = new Map(
    projection.evidence.map((row) => [row.key, row]),
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Alpha publication"
        title={projection.title}
        description={projection.question}
        actions={
          <>
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {geographyLabel(projection.geography)}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {projection.operationalLabel}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              Published {new Date(projection.publishedAt).toLocaleString()}
            </span>
          </>
        }
      />

      <DisclosureNotice title="Invite-only alpha publication" tone="caution">
        This is a resettable alpha publication from the gated environment. It is
        not government adoption, legal authority, or truth certification.
        Evidence quality labels are independent of popularity and consultation
        agreement.
      </DisclosureNotice>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-heading text-xl text-foreground">Background</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {projection.background}
          </p>
        </div>
        <div className="space-y-3">
          <h2 className="font-heading text-xl text-foreground">Scope</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {projection.scope}
          </p>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="gated-claims-heading">
        <h2
          id="gated-claims-heading"
          className="font-heading text-2xl text-foreground"
        >
          Claims and evidence
        </h2>
        <div className="space-y-6">
          {projection.claims.map((claim) => (
            <article
              key={`${claim.title}:${claim.approachLabel}`}
              className="space-y-4 border-t border-border pt-4"
            >
              <h3 className="font-heading text-xl text-foreground">
                {claim.title}
              </h3>
              <p className="text-sm text-muted-foreground">{claim.summary}</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Approach: </span>
                {claim.approachLabel}
              </p>
              {claim.workflowPublicRationale ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Public claim review:{" "}
                  </span>
                  {claim.workflowPublicRationale}
                </p>
              ) : null}
              {claim.conflictPublicSummary ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Conflict summary:{" "}
                  </span>
                  {claim.conflictPublicSummary}
                </p>
              ) : null}
              <ul className="space-y-3">
                {claim.evidenceLinks.map((link) => {
                  const evidence = evidenceByKey.get(link.evidenceKey);
                  if (!evidence) return null;
                  return (
                    <li
                      key={`${link.relationship}:${link.evidenceKey}`}
                      className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
                    >
                      <p className="font-medium text-foreground">
                        {evidence.title}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({link.relationship})
                        </span>
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {evidence.organization} · {evidence.authorType} ·{" "}
                        {evidence.sourceType}
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Quality:{" "}
                        </span>
                        {evidence.qualityStatus.replaceAll("_", " ")}.{" "}
                        {qualityPlainLanguage(evidence.qualityStatus)}
                      </p>
                      {evidence.qualityPublicRationale ? (
                        <p className="mt-2 text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Quality rationale:{" "}
                          </span>
                          {evidence.qualityPublicRationale}
                        </p>
                      ) : null}
                      {evidence.workflowPublicRationale ? (
                        <p className="mt-2 text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Workflow rationale:{" "}
                          </span>
                          {evidence.workflowPublicRationale}
                        </p>
                      ) : null}
                      <p className="mt-2 text-muted-foreground">
                        Limitations: {evidence.limitations}
                      </p>
                      <p className="mt-3">
                        <a
                          href={evidence.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          Open third-party source URL
                        </a>
                        <span className="ml-2 text-xs text-muted-foreground">
                          (not fetched by this application)
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        <Link href="/topics" className="underline underline-offset-2">
          Back to published topics
        </Link>
      </p>
    </div>
  );
}
