import { ConflictDisclosureCard } from "@/components/topics/ConflictDisclosureCard";
import {
  relationshipLabelFor,
  type EvidenceDisclosureItem,
} from "@/features/topics/evidence-disclosure-model";
import { cn } from "@/lib/utils";

type EvidenceDisclosureProps = {
  item: EvidenceDisclosureItem;
  /** When false, omit id= anchor (e.g. claim summaries that are not the inventory). */
  anchor?: boolean;
  className?: string;
};

/**
 * Visitor-facing progressive disclosure for evidence items.
 * Uses native &lt;details&gt;/&lt;summary&gt; for keyboard, screen-reader, and no-JS support.
 * Default closed; never auto-opens from URL/storage/session.
 */
export function EvidenceDisclosure({
  item,
  anchor = true,
  className,
}: EvidenceDisclosureProps) {
  const summaryQuality = item.qualityLabel;
  const relationship =
    item.relationshipLabel || relationshipLabelFor(item.relationship);

  return (
    <article
      id={anchor ? item.id : undefined}
      className={cn(
        "scroll-mt-28 rounded-md border border-border bg-surface-muted",
        className,
      )}
      data-testid="evidence-disclosure"
      data-evidence-id={item.id}
    >
      <details className="group" data-testid="evidence-disclosure-details">
        <summary
          className={cn(
            "cursor-pointer list-none rounded-md p-4 outline-none",
            "focus-visible:ring-3 focus-visible:ring-ring/50",
            "[&::-webkit-details-marker]:hidden",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-surface px-2 py-1 text-xs font-medium text-foreground">
              {relationship}
            </span>
            <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
              {summaryQuality}
            </span>
          </div>
          <h4 className="mt-3 text-sm font-medium text-foreground">{item.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.sourceOrganizationOrType}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {item.contributionSentence}
          </p>
          <p className="mt-3 text-sm font-medium text-primary underline-offset-4 group-open:no-underline">
            <span className="group-open:hidden">
              View evidence details and source
            </span>
            <span className="hidden group-open:inline">Hide evidence details</span>
          </p>
        </summary>

        <div
          className="space-y-3 border-t border-border px-4 pb-4 pt-3 text-sm"
          data-testid="evidence-disclosure-details-panel"
        >
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {item.publishedOn ? (
              <div>
                <dt className="font-medium text-foreground">Published</dt>
                <dd>{item.publishedOn}</dd>
              </div>
            ) : null}
            {item.authorTypeLabel ? (
              <div>
                <dt className="font-medium text-foreground">Author type</dt>
                <dd>{item.authorTypeLabel}</dd>
              </div>
            ) : null}
            {item.sourceTypeLabel ? (
              <div>
                <dt className="font-medium text-foreground">Source type</dt>
                <dd>{item.sourceTypeLabel}</dd>
              </div>
            ) : null}
            {item.qualityRationale ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">Quality rationale</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {item.qualityRationale}
                </dd>
              </div>
            ) : null}
            {item.workflowRationale ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">
                  Review decision (public)
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {item.workflowRationale}
                </dd>
              </div>
            ) : null}
            {item.limitations ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">Limitations</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {item.limitations}
                </dd>
              </div>
            ) : null}
            {item.conflictSummary ? (
              <div className="sm:col-span-2">
                <ConflictDisclosureCard
                  publicSummary={item.conflictSummary}
                  title="Evidence conflict disclosure"
                  headingId={`${item.id}-evidence-conflict`}
                />
              </div>
            ) : null}
            {item.revisionSummaryLabel ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">Revision summary</dt>
                <dd className="mt-1 break-words">{item.revisionSummaryLabel}</dd>
              </div>
            ) : null}
            {item.moderationNoticeLabel ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">
                  Moderation or restoration notice
                </dt>
                <dd className="mt-1 break-words">{item.moderationNoticeLabel}</dd>
              </div>
            ) : null}
            {item.extendedExplanation ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">Additional context</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {item.extendedExplanation}
                </dd>
              </div>
            ) : null}
            {item.linkedClaimLabels.length > 0 ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">Linked claims</dt>
                <dd className="mt-1">
                  <ul className="list-disc space-y-1 pl-5">
                    {item.linkedClaimLabels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>

          {item.sourceUrl && item.sourceLinkTitle ? (
            <p>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="break-words text-primary underline"
                data-testid="evidence-source-link"
              >
                {item.sourceLinkTitle}
                {item.sourceHostname ? ` (${item.sourceHostname})` : ""}
              </a>
              <span className="mt-1 block text-xs text-muted-foreground">
                External link — not fetched by this application.
              </span>
            </p>
          ) : (
            <p
              className="text-xs text-muted-foreground"
              data-testid="evidence-source-unavailable"
            >
              {item.sourceUnavailableLabel ??
                "Source link unavailable or redacted in this projection."}
            </p>
          )}
        </div>
      </details>
    </article>
  );
}
