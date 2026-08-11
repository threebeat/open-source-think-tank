"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

type ClaimReviewFormProps = {
  claimId: string;
  expectedWorkflowState: "submitted";
};

export function ClaimReviewForm({
  claimId,
  expectedWorkflowState,
}: ClaimReviewFormProps) {
  const router = useRouter();
  const errorSummaryId = useId();
  const rationaleHelpId = useId();
  const privateHelpId = useId();
  const [decision, setDecision] = useState<
    "changes_requested" | "accepted" | "rejected"
  >("changes_requested");
  const [publicRationale, setPublicRationale] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [confirmRejected, setConfirmRejected] = useState(false);
  const [rubricChecked, setRubricChecked] = useState({
    contentClear: false,
    limitationsPresent: false,
    notPopularity: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (decision === "rejected" && !confirmRejected) {
      setError("Confirm the rejected decision before submitting.");
      document.getElementById(errorSummaryId)?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspace/review/claims/${claimId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            decision,
            publicRationale,
            privateNotes: privateNotes.trim() ? privateNotes : null,
            expectedWorkflowState,
          }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not record claim review");
        document.getElementById(errorSummaryId)?.focus();
        return;
      }
      router.push("/workspace/review");
      router.refresh();
    } catch {
      setError("Could not record claim review");
      document.getElementById(errorSummaryId)?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5" noValidate>
      <p className="text-sm text-muted-foreground">
        Public rationale may become visitor-visible if this topic is later
        published. Private reviewer notes stay staff-only. Rubric answers are
        decision support only and are not stored as a numeric score.
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

      <fieldset className="space-y-2">
        <legend className="font-medium">Review checklist (ephemeral)</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={rubricChecked.contentClear}
            onChange={(event) =>
              setRubricChecked((value) => ({
                ...value,
                contentClear: event.target.checked,
              }))
            }
          />
          <span>Claim content is clear enough to review.</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={rubricChecked.limitationsPresent}
            onChange={(event) =>
              setRubricChecked((value) => ({
                ...value,
                limitationsPresent: event.target.checked,
              }))
            }
          />
          <span>Linked evidence limitations are present and readable.</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={rubricChecked.notPopularity}
            onChange={(event) =>
              setRubricChecked((value) => ({
                ...value,
                notPopularity: event.target.checked,
              }))
            }
          />
          <span>
            This decision is not based on popularity, consensus, or ideology.
          </span>
        </label>
      </fieldset>

      <label className="block space-y-2 text-sm">
        <span>Decision</span>
        <select
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          value={decision}
          onChange={(event) =>
            setDecision(
              event.target.value as
                | "changes_requested"
                | "accepted"
                | "rejected",
            )
          }
          required
        >
          <option value="changes_requested">Changes requested</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>

      <label className="block space-y-2 text-sm">
        <span>Public rationale (required)</span>
        <textarea
          className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2"
          value={publicRationale}
          onChange={(event) => setPublicRationale(event.target.value)}
          aria-describedby={rationaleHelpId}
          required
          minLength={8}
          maxLength={4000}
        />
        <span id={rationaleHelpId} className="block text-xs text-muted-foreground">
          Explain the workflow decision in plain language. Do not include
          contact, verification, or private disclosure detail.
        </span>
      </label>

      <label className="block space-y-2 text-sm">
        <span>Private reviewer notes (optional, staff-only)</span>
        <textarea
          className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2"
          value={privateNotes}
          onChange={(event) => setPrivateNotes(event.target.value)}
          aria-describedby={privateHelpId}
          maxLength={4000}
        />
        <span id={privateHelpId} className="block text-xs text-muted-foreground">
          Never shown to participants or visitors.
        </span>
      </label>

      {decision === "rejected" ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmRejected}
            onChange={(event) => setConfirmRejected(event.target.checked)}
          />
          <span>
            I confirm this terminal rejected decision for the submitted claim.
          </span>
        </label>
      ) : null}

      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Recording…" : "Record claim review"}
      </button>
    </form>
  );
}
