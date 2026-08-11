"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  allowedTopicActions,
  type TopicTransitionAction,
} from "@/lib/topics/transitions";
import type { TopicWorkflowState } from "@/lib/topics/repository";

const ACTION_LABELS: Record<TopicTransitionAction, string> = {
  open: "Open for submissions",
  begin_review: "Begin review",
  reopen: "Reopen for submissions",
  pause: "Pause",
  archive: "Archive",
};

type TopicTransitionControlsProps = {
  topicId: string;
  workflowState: TopicWorkflowState;
};

export function TopicTransitionControls({
  topicId,
  workflowState,
}: TopicTransitionControlsProps) {
  const router = useRouter();
  const actions = useMemo(
    () => allowedTopicActions(workflowState),
    [workflowState],
  );
  const [action, setAction] = useState<TopicTransitionAction | "">(
    actions[0] ?? "",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No further operational transitions are available from the current state
        in Package 3.4. Publication remains a later package.
      </p>
    );
  }

  const needsReason =
    action === "begin_review" ||
    action === "reopen" ||
    action === "pause" ||
    action === "archive";
  const needsConfirm = action === "pause" || action === "archive";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!action) return;
    if (needsConfirm) {
      const confirmed = window.confirm(
        action === "archive"
          ? "Archive this topic? Archive is terminal in 3.4 and does not unpublish."
          : "Pause this topic? Pause is operational and does not unpublish.",
      );
      if (!confirmed) return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspace/topics/${topicId}/transition`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            expectedWorkflowState: workflowState,
            reason: reason || undefined,
          }),
        },
      );
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        if (response.status === 409) {
          setError(
            "This topic changed elsewhere. Reload the page and try again.",
          );
        } else {
          setError(data.error ?? "Transition failed");
        }
        return;
      }
      setReason("");
      router.refresh();
    } catch {
      setError("Transition failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4" noValidate>
      {error ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Operational transition</legend>
        <label className="block space-y-2 text-sm">
          <span>Action</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={action}
            onChange={(event) =>
              setAction(event.target.value as TopicTransitionAction)
            }
            required
          >
            {actions.map((value) => (
              <option key={value} value={value}>
                {ACTION_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {needsReason ? (
          <label className="block space-y-2 text-sm">
            <span>Substantive reason (required)</span>
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              rows={3}
              value={reason}
              minLength={8}
              required
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">
            Opening a draft for submissions does not require a reason.
          </p>
        )}
      </fieldset>

      <p className="text-sm text-muted-foreground">
        There is no Publish or Unpublish control in Package 3.4. Gated
        publication lands in 3.6. Invalid transitions are still rejected on the
        server.
      </p>

      <button
        type="submit"
        disabled={pending || !action}
        className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm text-background disabled:opacity-60"
      >
        {pending ? "Applying…" : "Apply transition"}
      </button>
    </form>
  );
}
