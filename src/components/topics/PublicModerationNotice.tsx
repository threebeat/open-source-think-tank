type PublicModerationNoticeProps = {
  action: "hold" | "hide" | "restore";
  publicRationale: string;
  recordedAt: string;
  subjectKind?: "claim" | "evidence";
  /** Optional heading override for the notice. */
  title?: string;
};

function defaultTitle(
  action: PublicModerationNoticeProps["action"],
  subjectKind: PublicModerationNoticeProps["subjectKind"],
): string {
  const subject =
    subjectKind === "evidence"
      ? "Evidence"
      : subjectKind === "claim"
        ? "Claim"
        : "Content";
  switch (action) {
    case "hold":
      return `${subject} temporarily withheld`;
    case "hide":
      return `${subject} withheld from this publication`;
    case "restore":
      return `${subject} restored to visibility`;
  }
}

/**
 * Presentational allowlisted moderation notice.
 * Safe for public-demo and gated public surfaces — pure props only.
 * Restoration is not approval, truth, or consensus.
 */
export function PublicModerationNotice({
  action,
  publicRationale,
  recordedAt,
  subjectKind,
  title,
}: PublicModerationNoticeProps) {
  const heading = title ?? defaultTitle(action, subjectKind);

  return (
    <aside
      className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm leading-6"
      aria-label={heading}
    >
      <p className="font-medium text-foreground">{heading}</p>
      <p className="mt-1 text-muted-foreground whitespace-pre-wrap break-words">
        {publicRationale}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Recorded {new Date(recordedAt).toLocaleString()}
        {action === "restore"
          ? ". Restoration returns content to the published projection; it is not approval, truth certification, or consensus."
          : ". Withholding is a visibility action; content is retained and is not deleted."}
      </p>
    </aside>
  );
}
