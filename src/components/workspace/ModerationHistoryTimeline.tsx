import type { StaffModerationActionDto } from "@/lib/moderation/repository";

type ModerationHistoryTimelineProps = {
  history: StaffModerationActionDto[];
  title?: string;
};

function actionLabel(action: StaffModerationActionDto["action"]): string {
  switch (action) {
    case "hold":
      return "Held";
    case "hide":
      return "Hidden";
    case "restore":
      return "Restored to visible";
  }
}

/**
 * Staff moderation history. Shows from/to visibility, action, time, public
 * rationale, and private notes. Never renders raw audit JSON.
 */
export function ModerationHistoryTimeline({
  history,
  title = "Moderation history",
}: ModerationHistoryTimelineProps) {
  return (
    <section className="space-y-3" aria-labelledby="moderation-history-heading">
      <h2 id="moderation-history-heading" className="font-heading text-xl">
        {title}
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No moderation actions recorded yet.
        </p>
      ) : (
        <ol className="space-y-3" aria-label={title}>
          {history.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
            >
              <p className="font-medium">
                {actionLabel(entry.action)} · {entry.fromVisibility} →{" "}
                {entry.toVisibility} ·{" "}
                {new Date(entry.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 text-muted-foreground">
                <span className="font-medium text-foreground">
                  Public rationale:{" "}
                </span>
                {entry.publicRationale}
              </p>
              {entry.privateNotes ? (
                <p className="mt-1 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Private notes:{" "}
                  </span>
                  {entry.privateNotes}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
