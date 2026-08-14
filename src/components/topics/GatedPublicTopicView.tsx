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
import { PublicTime } from "@/components/topics/PublicTime";
import { EvidenceDisclosure } from "@/features/topics/EvidenceDisclosure";
import {
  linkedClaimTitlesForPublicEvidence,
  mapPublicEvidenceToDisclosure,
  primaryRelationshipForPublicEvidence,
} from "@/features/topics/map-evidence-disclosure";
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
  status: "accepted" | "limited" | "disputed",
): string {
  switch (status) {
    case "accepted":
      return "Accepted quality means reviewers found the source usable for this alpha publication. It does not prove a claim is true.";
    case "limited":
      return "Limited quality means the source is useful with clear constraints. It does not prove a claim is true.";
    case "disputed":
      return "Disputed quality means reviewers recorded contested source fitness. It does not prove a claim is true or false.";
  }
}

type GatedPublicTopicViewProps = {
  projection: PublicTopicProjection;
  /** When true, omit the page chrome so the view can embed in Evidence. */
  embedded?: boolean;
};

export function GatedPublicTopicView({
  projection,
  embedded = false,
}: GatedPublicTopicViewProps) {
  const evidenceByKey = new Map(
    projection.evidence.map((row) => [row.key, row]),
  );
  const hasIncludedContent =
    projection.claims.length > 0 && projection.evidence.length > 0;

  return (
    <div className="space-y-10" data-testid="gated-public-topic-view">
      {!embedded ? (
        <>
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
                  <PublicTime
                    dateTime={projection.publishedAt}
                    prefix="Published "
                  />
                </span>
              </>
            }
          />

          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">Tennessee geography</dt>
              <dd className="mt-1 text-muted-foreground break-words">
                {geographyLabel(projection.geography)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Operational status</dt>
              <dd className="mt-1 text-muted-foreground break-words">
                {projection.operationalLabel}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Publication date</dt>
              <dd className="mt-1 text-muted-foreground">
                <PublicTime dateTime={projection.publishedAt} />
              </dd>
            </div>
          </dl>

          <DisclosureNotice title="Invite-only alpha publication" tone="caution">
            This is a resettable alpha publication from the gated environment. It is
            not government adoption, legal authority, or truth certification. No
            public author attribution is shown while that question remains open.
          </DisclosureNotice>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 min-w-0">
              <h2 className="font-heading text-xl text-foreground">Background</h2>
              <p className="text-sm leading-6 text-muted-foreground break-words whitespace-pre-wrap">
                {projection.background}
              </p>
            </div>
            <div className="space-y-3 min-w-0">
              <h2 className="font-heading text-xl text-foreground">Scope</h2>
              <p className="text-sm leading-6 text-muted-foreground break-words whitespace-pre-wrap">
                {projection.scope}
              </p>
            </div>
          </section>
        </>
      ) : null}

      <section
        className="space-y-3"
        aria-labelledby="how-to-read-publication-heading"
      >
        <h2
          id="how-to-read-publication-heading"
          className="font-heading text-xl text-foreground"
        >
          How to read this publication
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Evidence quality labels describe source fitness for this alpha. They
            are not claim truth.
          </li>
          <li>
            Workflow acceptance means reviewers advanced the submission. It is
            not popularity, consultation agreement, or institutional consensus.
          </li>
          <li>
            Evidence details stay collapsed until you choose “View evidence
            details and source.” Collapsing is for readability, not privacy.
          </li>
          <li>
            Moderation visibility (hold, hide, restore) is independent from
            workflow status and evidence quality.
          </li>
        </ul>
      </section>

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

      <section className="space-y-4" aria-labelledby="gated-claims-heading">
        <h2
          id="gated-claims-heading"
          className="font-heading text-2xl text-foreground"
        >
          Claims and evidence
        </h2>

        {!hasIncludedContent ? (
          <DisclosureNotice
            title="No currently included claims or evidence"
            tone="neutral"
          >
            This topic remains published, but no claim or evidence currently
            meets the public projection allowlist. Withheld or ineligible
            material is not listed here, and moderation does not silently
            unpublish the topic.
          </DisclosureNotice>
        ) : (
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

              const supporting = linked.filter(
                (row) => row.link.relationship === "supporting",
              );
              const counterevidence = linked.filter(
                (row) => row.link.relationship === "counterevidence",
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
                  qualityPublicRationale: null,
                  workflowPublicRationale: null,
                  sourceUrl: null,
                  revisionSummaryLabel: null,
                }),
              );

              const claimConflictHeadingId = `claim-${claimIndex}-conflict`;

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
                  <p className="text-sm text-muted-foreground break-words">
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
                      title="Claim conflict disclosure"
                      headingId={claimConflictHeadingId}
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
                  <PublicRevisionSummaryNotice
                    summary={claim.revisionSummary}
                  />

                  <div className="grid gap-6 lg:grid-cols-2">
                    <CompactLinkedEvidence
                      headingId={`claim-${claimIndex}-supporting`}
                      heading="Supporting evidence"
                      empty="No supporting sources in this publication."
                      rows={supporting}
                    />
                    <CompactLinkedEvidence
                      headingId={`claim-${claimIndex}-counter`}
                      heading="Counterevidence"
                      empty="No counterevidence in this publication."
                      rows={counterevidence}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Inspect individual sources in the evidence inventory below.
                    Source links and extended metadata stay collapsed until you
                    expand an item.
                  </p>

                  {comparable.length >= 2 ? (
                    <EvidenceComparison
                      claimTitle={claim.title}
                      items={comparable}
                    />
                  ) : null}
                </article>
              );
            })}

            <section
              className="space-y-4"
              aria-labelledby="gated-evidence-inventory-heading"
            >
              <h3
                id="gated-evidence-inventory-heading"
                className="font-heading text-xl text-foreground"
              >
                Evidence inventory
              </h3>
              <p className="text-sm text-muted-foreground">
                Canonical place to inspect each publication-eligible source.
                Details and external links remain collapsed by default.
              </p>
              <ul className="grid gap-4 lg:grid-cols-2">
                {projection.evidence.map((evidence) => {
                  const item = mapPublicEvidenceToDisclosure({
                    evidence,
                    relationship: primaryRelationshipForPublicEvidence(
                      evidence.key,
                      projection.claims,
                    ),
                    linkedClaimTitles: linkedClaimTitlesForPublicEvidence(
                      evidence.key,
                      projection.claims,
                    ),
                  });
                  return (
                    <li key={evidence.key}>
                      <EvidenceDisclosure item={item} />
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </section>

      <p>
        <Link
          href="/agenda"
          className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-2"
        >
          Back to Agenda
        </Link>
      </p>
    </div>
  );
}

function CompactLinkedEvidence({
  headingId,
  heading,
  empty,
  rows,
}: {
  headingId: string;
  heading: string;
  empty: string;
  rows: Array<{
    evidence: PublicTopicProjection["evidence"][number];
  }>;
}) {
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-2">
      <h4 id={headingId} className="text-sm font-medium text-foreground">
        {heading}
        <span className="ml-2 font-normal text-muted-foreground">
          ({rows.length})
        </span>
      </h4>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ evidence }) => (
            <li key={evidence.key}>
              <a
                href={`#${evidence.key}`}
                className="block rounded-md border border-border px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="font-medium text-foreground break-words">
                  {evidence.title}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground break-words">
                  {evidence.organization} ·{" "}
                  {evidence.qualityStatus.replaceAll("_", " ")}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
