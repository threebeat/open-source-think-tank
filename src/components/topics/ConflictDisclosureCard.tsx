type ConflictDisclosureCardProps = {
  publicSummary: string;
  /** Only render private detail when the server explicitly passes it. Never CSS-hide. */
  privateDetail?: string | null;
  title?: string;
  /** Unique heading id when multiple conflict cards appear on one page. */
  headingId?: string;
};

/**
 * Presentational conflict disclosure summary.
 * Private detail is omitted entirely unless explicitly provided by the caller.
 */
export function ConflictDisclosureCard({
  publicSummary,
  privateDetail = null,
  title = "Conflict disclosure",
  headingId = "conflict-disclosure-card-heading",
}: ConflictDisclosureCardProps) {
  const showPrivate =
    typeof privateDetail === "string" && privateDetail.trim().length > 0;

  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="font-heading text-lg text-foreground break-words"
      >
        {title}
      </h3>
      <div className="space-y-2 text-sm">
        <div>
          <p className="font-medium text-foreground">Public summary</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
            {publicSummary}
          </p>
        </div>
        {showPrivate ? (
          <div>
            <p className="font-medium text-foreground">
              Private detail (not public)
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
              {privateDetail}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
