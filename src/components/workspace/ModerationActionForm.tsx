"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ModerationVisibility = "visible" | "held" | "hidden";
type ModerationAction = "hold" | "hide" | "restore";

type ModerationActionFormProps = {
  subjectType: "claim" | "evidence";
  subjectId: string;
  currentVisibility: ModerationVisibility;
  expectedUpdatedAt: string;
};

function actionsFor(visibility: ModerationVisibility): ModerationAction[] {
  switch (visibility) {
    case "visible":
      return ["hold", "hide"];
    case "held":
      return ["hide", "restore"];
    case "hidden":
      return ["restore"];
  }
}

function actionLabel(action: ModerationAction): string {
  switch (action) {
    case "hold":
      return "Hold (temporarily withhold)";
    case "hide":
      return "Hide from public projection";
    case "restore":
      return "Restore to visible";
  }
}

export function ModerationActionForm({
  subjectType,
  subjectId,
  currentVisibility,
  expectedUpdatedAt,
}: ModerationActionFormProps) {
  const router = useRouter();
  const errorSummaryId = useId();
  const rationaleHelpId = useId();
  const privateHelpId = useId();
  const available = useMemo(
    () => actionsFor(currentVisibility),
    [currentVisibility],
  );
  const [action, setAction] = useState<ModerationAction>(
    available[0] ?? "hold",
  );
  const [publicRationale, setPublicRationale] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const endpoint =
    subjectType === "claim"
      ? `/api/workspace/moderation/claims/${subjectId}`
      : `/api/workspace/moderation/evidence/${subjectId}`;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!available.includes(action)) {
      setError(
        "That moderation action is not allowed from the current visibility.",
      );
      document.getElementById(errorSummaryId)?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          publicRationale,
          privateNotes: privateNotes.trim() ? privateNotes : null,
          expectedVisibility: currentVisibility,
          expectedUpdatedAt,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not record moderation action");
        document.getElementById(errorSummaryId)?.focus();
        return;
      }
      router.push("/workspace/moderation");
      router.refresh();
    } catch {
      setError("Could not record moderation action");
      document.getElementById(errorSummaryId)?.focus();
    } finally {
      setPending(false);
    }
  }

  if (available.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No moderation transitions are available from the current visibility.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5" noValidate>
      <p className="text-sm text-muted-foreground">
        Hold and hide withhold content from public projection without deleting
        it. Restore returns content to visible. Restoration is not approval,
        truth certification, or consensus. Public rationale may appear on
        published topics; private notes stay staff-only.
      </p>

      {error ? (
        <div
          id={errorSummaryId}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <input
        type="hidden"
        name="expectedVisibility"
        value={currentVisibility}
      />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />

      <fieldset className="space-y-3">
        <legend className="font-medium">Moderation action</legend>
        {available.map((option) => (
          <label
            key={option}
            className="flex min-h-11 items-center gap-3 text-sm"
          >
            <input
              type="radio"
              name={`moderation-action-${subjectType}-${subjectId}`}
              className="size-4"
              checked={action === option}
              onChange={() => setAction(option)}
            />
            <span>{actionLabel(option)}</span>
          </label>
        ))}
      </fieldset>

      <label className="block space-y-2 text-sm">
        <span>Public rationale (required)</span>
        <textarea
          className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-base"
          value={publicRationale}
          onChange={(event) => setPublicRationale(event.target.value)}
          aria-describedby={rationaleHelpId}
          required
          minLength={8}
          maxLength={4000}
        />
        <span
          id={rationaleHelpId}
          className="block text-xs text-muted-foreground"
        >
          Explain the visibility action in plain language. Do not include
          contact, verification, or private disclosure detail.
        </span>
      </label>

      <label className="block space-y-2 text-sm">
        <span>Private moderator notes (optional, staff-only)</span>
        <textarea
          className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-base"
          value={privateNotes}
          onChange={(event) => setPrivateNotes(event.target.value)}
          aria-describedby={privateHelpId}
          maxLength={4000}
        />
        <span
          id={privateHelpId}
          className="block text-xs text-muted-foreground"
        >
          Never shown to participants or visitors.
        </span>
      </label>

      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Recording…" : "Record moderation action"}
      </button>
    </form>
  );
}
