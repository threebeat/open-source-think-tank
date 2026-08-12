import { PublicTime } from "@/components/topics/PublicTime";
import type { ContentRevisionHistoryDto } from "@/lib/revisions/history";
import type { PublicRevisionSummaryProjection } from "@/lib/topics/public-projection";

type FullHistoryProps = {
  title: string;
  history: ContentRevisionHistoryDto | null;
  /** When a review decision predates the latest content revision. */
  reviewPredatesLatestRevision?: boolean;
  latestReviewAt?: string | null;
};

/**
 * Owner/staff full before/after revision history.
 * Distinct from review decisions and evidence quality labels.
 */
export function RevisionHistoryPanel({
  title,
  history,
  reviewPredatesLatestRevision = false,
  latestReviewAt = null,
}: FullHistoryProps) {
  if (!history || history.entries.length === 0) {
    return (
      <section className="space-y-2" aria-label={title}>
        <h3 className="font-heading text-lg text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">
          No content revisions recorded yet. Draft-only edits before first
          submission are not versioned.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label={title}>
      <h3 className="font-heading text-lg text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">
        Revision timestamps record when content was edited. They are not
        institutional approval timestamps.
      </p>
      {reviewPredatesLatestRevision && latestReviewAt ? (
        <p
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          role="status"
        >
          A review decision recorded on{" "}
          {new Date(latestReviewAt).toLocaleString()} predates the latest
          content revision
          {history.latestRevisionAt
            ? ` (${new Date(history.latestRevisionAt).toLocaleString()})`
            : ""}
          . Review history is preserved; the older decision was not altered.
        </p>
      ) : null}
      <ol className="space-y-3">
        {history.entries.map((entry) => (
          <li
            key={entry.revisionNumber}
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
          >
            <details className="group">
              <summary className="cursor-pointer list-none font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                <span className="underline-offset-2 group-open:underline">
                  Revision {entry.revisionNumber}
                </span>
                <span className="mt-1 block font-normal text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()} · Changed:{" "}
                  {entry.changedFieldLabels.join(", ")}
                </span>
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <h4 className="font-medium text-foreground">
                    Previous content
                  </h4>
                  <SnapshotFields snapshot={entry.before} />
                </div>
                <div className="min-w-0 space-y-2">
                  <h4 className="font-medium text-foreground">
                    Current content (after this revision)
                  </h4>
                  <SnapshotFields snapshot={entry.after} />
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SnapshotFields({
  snapshot,
}: {
  snapshot: Record<string, unknown>;
}) {
  const labels: Record<string, string> = {
    title: "Title",
    summary: "Summary",
    approachLabel: "Approach label",
    sourceUrl: "Source URL",
    organization: "Organization",
    authorType: "Author type",
    sourceType: "Source type",
    limitations: "Limitations",
  };

  return (
    <dl className="space-y-2 text-sm">
      {Object.entries(snapshot).map(([key, value]) => (
        <div key={key}>
          <dt className="font-medium text-foreground">
            {labels[key] ?? key}
          </dt>
          <dd className="break-words whitespace-pre-wrap text-muted-foreground">
            {String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type PublicSummaryProps = {
  summary: PublicRevisionSummaryProjection | null | undefined;
  label?: string;
};

/** Visitor-safe revision summary for published topics. */
export function PublicRevisionSummaryNotice({
  summary,
  label = "Revision summary",
}: PublicSummaryProps) {
  if (!summary || summary.revisionCount <= 0) return null;

  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{label}: </span>
      {summary.revisionCount} content revision
      {summary.revisionCount === 1 ? "" : "s"}
      {summary.latestRevisionAt ? (
        <>
          {" · latest "}
          <PublicTime dateTime={summary.latestRevisionAt} />
        </>
      ) : null}
      {summary.changedFieldLabels.length > 0
        ? ` · ${summary.changedFieldLabels.join("; ")}`
        : ""}
      . Revision times are edit records, not approval stamps.
    </p>
  );
}
