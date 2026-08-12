import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { ConflictDisclosureCard } from "@/components/topics/ConflictDisclosureCard";
import {
  EvidenceComparison,
  type ComparableEvidenceItem,
} from "@/components/topics/EvidenceComparison";
import { PublicModerationNotice } from "@/components/topics/PublicModerationNotice";
import { PublicRevisionSummaryNotice } from "@/components/topics/RevisionHistoryPanel";
import { formatTopicGeography } from "@/lib/geography/tennessee-counties";
import { groupEvidenceByRelationship } from "@/lib/topics/evidence-groups";
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

function EvidenceBlock({
  evidence,
  relationship,
}: {
  evidence: PublicTopicProjection["evidence"][number];
  relationship: "supporting" | "counterevidence";
}) {
  return (
    <li className="min-w-0 rounded-md border border-border bg-surface px-4 py-3 text-sm">
      <p className="font-medium text-foreground break-words">
        {evidence.title}
      </p>
      <p className="mt-1 text-muted-foreground break-words">
        {relationship === "supporting"
          ? "Supporting evidence"
          : "Counterevidence"}{" "}
        · {evidence.organization} · {evidence.authorType} ·{" "}
        {evidence.sourceType}
      </p>
      <p className="mt-2 text-muted-foreground break-words">
        <span className="font-medium text-foreground">Evidence quality: </span>
        {evidence.qualityStatus.replaceAll("_", " ")}.{" "}
        {qualityPlainLanguage(evidence.qualityStatus)}
      </p>
      {evidence.qualityPublicRationale ? (
        <p className="mt-2 text-muted-foreground break-words whitespace-pre-wrap">
          <span className="font-medium text-foreground">
            Quality rationale:{" "}
          </span>
          {evidence.qualityPublicRationale}
        </p>
      ) : null}
      {evidence.workflowPublicRationale ? (
        <p className="mt-2 text-muted-foreground break-words whitespace-pre-wrap">
          <span className="font-medium text-foreground">
            Review decision (public):{" "}
          </span>
          {evidence.workflowPublicRationale}
        </p>
      ) : null}
      <p className="mt-2 text-muted-foreground break-words whitespace-pre-wrap">
        <span className="font-medium text-foreground">Limitations: </span>
        {evidence.limitations}
      </p>
      {evidence.latestRestorationNotice ? (
        <div className="mt-2">
          <PublicModerationNotice
            action={evidence.latestRestorationNotice.action}
            publicRationale={evidence.latestRestorationNotice.publicRationale}
            recordedAt={evidence.latestRestorationNotice.recordedAt}
            subjectKind="evidence"
          />
        </div>
      ) : null}
      <PublicRevisionSummaryNotice summary={evidence.revisionSummary} />
      <p className="mt-2">
        <a
          href={evidence.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className="break-all text-primary underline"
        >
          {evidence.sourceUrl}
        </a>
        <span className="mt-1 block text-xs text-muted-foreground">
          External link — not fetched by this application.
        </span>
      </p>
    </li>
  );
}

type GatedPublicTopicViewProps = {
  projection: PublicTopicProjection;
};

export function GatedPublicTopicView({
  projection,
}: GatedPublicTopicViewProps) {
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
        agreement. Supporting and counterevidence are shown for comparison;
        neither side is ranked.
      </DisclosureNotice>

      {projection.withheldModerationNotices.length > 0 ? (
        <section
          className="space-y-3"
          aria-labelledby="withheld-moderation-heading"
        >
          <h2
            id="withheld-moderation-heading"
            className="font-heading text-xl text-foreground"
          >
            Withheld from this publication
          </h2>
          <p className="text-sm text-muted-foreground">
            Some accepted material is currently withheld. Notices below include
            only the public rationale and date — not titles, bodies, or source
            URLs.
          </p>
          <ul className="space-y-3">
            {projection.withheldModerationNotices.map((notice, index) => (
              <li key={`${notice.subjectKind}-${notice.recordedAt}-${index}`}>
                <PublicModerationNotice
                  action={notice.action}
                  publicRationale={notice.publicRationale}
                  recordedAt={notice.recordedAt}
                  subjectKind={notice.subjectKind}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
        <div className="space-y-8">
          {projection.claims.map((claim, claimIndex) => {
            const linked = claim.evidenceLinks
              .map((link) => {
                const evidence = evidenceByKey.get(link.evidenceKey);
                if (!evidence) return null;
                return { link, evidence };
              })
              .filter(
                (
                  row,
                ): row is {
                  link: (typeof claim.evidenceLinks)[number];
                  evidence: PublicTopicProjection["evidence"][number];
                } => Boolean(row),
              );

            const grouped = groupEvidenceByRelationship(
              linked.map(({ link, evidence }) => ({
                relationship: link.relationship,
                evidence,
              })),
            );

            const comparable: ComparableEvidenceItem[] = linked.map(
              ({ link, evidence }) => ({
                key: `${claimIndex}-${link.evidenceKey}`,
                relationship: link.relationship,
                title: evidence.title,
                organization: evidence.organization,
                authorType: evidence.authorType,
                sourceType: evidence.sourceType,
                limitations: evidence.limitations,
                qualityStatus: evidence.qualityStatus,
                qualityPlainLanguage: qualityPlainLanguage(
                  evidence.qualityStatus,
                ),
                qualityPublicRationale: evidence.qualityPublicRationale,
                workflowPublicRationale: evidence.workflowPublicRationale,
                sourceUrl: evidence.sourceUrl,
                revisionSummaryLabel: evidence.revisionSummary
                  ? `${evidence.revisionSummary.revisionCount} revision(s)`
                  : null,
              }),
            );

            return (
              <article
                key={`${claim.title}:${claim.approachLabel}:${claimIndex}`}
                className="space-y-4 border-t border-border pt-4"
              >
                <h3 className="font-heading text-xl text-foreground break-words">
                  {claim.title}
                </h3>
                <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">
                  {claim.summary}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Approach:{" "}
                  </span>
                  {claim.approachLabel}
                </p>
                {claim.workflowPublicRationale ? (
                  <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">
                    <span className="font-medium text-foreground">
                      Public claim review:{" "}
                    </span>
                    {claim.workflowPublicRationale}
                  </p>
                ) : null}
                {claim.conflictPublicSummary ? (
                  <ConflictDisclosureCard
                    publicSummary={claim.conflictPublicSummary}
                    title="Conflict disclosure"
                  />
                ) : null}
                {claim.latestRestorationNotice ? (
                  <PublicModerationNotice
                    action={claim.latestRestorationNotice.action}
                    publicRationale={
                      claim.latestRestorationNotice.publicRationale
                    }
                    recordedAt={claim.latestRestorationNotice.recordedAt}
                    subjectKind="claim"
                  />
                ) : null}
                <PublicRevisionSummaryNotice summary={claim.revisionSummary} />

                <div className="grid gap-4 lg:grid-cols-2">
                  <section
                    aria-labelledby={`claim-${claimIndex}-supporting`}
                    className="space-y-2"
                  >
                    <h4
                      id={`claim-${claimIndex}-supporting`}
                      className="text-sm font-medium text-foreground"
                    >
                      Supporting evidence
                    </h4>
                    {grouped.supporting.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No supporting sources in this publication.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {grouped.supporting.map(({ evidence }) => (
                          <EvidenceBlock
                            key={evidence.key}
                            evidence={evidence}
                            relationship="supporting"
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                  <section
                    aria-labelledby={`claim-${claimIndex}-counter`}
                    className="space-y-2"
                  >
                    <h4
                      id={`claim-${claimIndex}-counter`}
                      className="text-sm font-medium text-foreground"
                    >
                      Counterevidence
                    </h4>
                    {grouped.counterevidence.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No counterevidence in this publication.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {grouped.counterevidence.map(({ evidence }) => (
                          <EvidenceBlock
                            key={evidence.key}
                            evidence={evidence}
                            relationship="counterevidence"
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                </div>

                <EvidenceComparison
                  claimTitle={claim.title}
                  items={comparable}
                />
              </article>
            );
          })}
        </div>
      </section>

      <p>
        <Link href="/topics" className="text-sm text-primary underline">
          Back to topics
        </Link>
      </p>
    </div>
  );
}
