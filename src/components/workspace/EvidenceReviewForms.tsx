"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

type EvidenceReviewFormsProps = {
  evidenceSubmissionId: string;
  expectedWorkflowState: string;
  expectedQualityStatus: string;
  canWorkflowReview: boolean;
};

export function EvidenceReviewForms({
  evidenceSubmissionId,
  expectedWorkflowState,
  expectedQualityStatus,
  canWorkflowReview,
}: EvidenceReviewFormsProps) {
  const router = useRouter();
  const workflowErrorId = useId();
  const qualityErrorId = useId();
  const workflowHelpId = useId();
  const qualityHelpId = useId();

  const [workflowDecision, setWorkflowDecision] = useState<
    "changes_requested" | "accepted" | "rejected"
  >("changes_requested");
  const [workflowRationale, setWorkflowRationale] = useState("");
  const [workflowNotes, setWorkflowNotes] = useState("");
  const [confirmRejected, setConfirmRejected] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowPending, setWorkflowPending] = useState(false);

  const [qualityStatus, setQualityStatus] = useState<
    "accepted" | "limited" | "disputed" | "rejected"
  >("limited");
  const [qualityRationale, setQualityRationale] = useState("");
  const [qualityNotes, setQualityNotes] = useState("");
  const [qualityError, setQualityError] = useState<string | null>(null);
  const [qualityPending, setQualityPending] = useState(false);

  async function onWorkflowSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (workflowDecision === "rejected" && !confirmRejected) {
      setWorkflowError("Confirm the rejected workflow decision before submitting.");
      document.getElementById(workflowErrorId)?.focus();
      return;
    }
    setWorkflowPending(true);
    setWorkflowError(null);
    try {
      const response = await fetch(
        `/api/workspace/review/evidence/${evidenceSubmissionId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "workflow",
            decision: workflowDecision,
            publicRationale: workflowRationale,
            privateNotes: workflowNotes.trim() ? workflowNotes : null,
            expectedWorkflowState,
          }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setWorkflowError(data.error ?? "Could not record workflow review");
        document.getElementById(workflowErrorId)?.focus();
        return;
      }
      router.refresh();
    } catch {
      setWorkflowError("Could not record workflow review");
      document.getElementById(workflowErrorId)?.focus();
    } finally {
      setWorkflowPending(false);
    }
  }

  async function onQualitySubmit(event: React.FormEvent) {
    event.preventDefault();
    setQualityPending(true);
    setQualityError(null);
    try {
      const response = await fetch(
        `/api/workspace/review/evidence/${evidenceSubmissionId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "quality",
            qualityStatus,
            publicRationale: qualityRationale,
            privateNotes: qualityNotes.trim() ? qualityNotes : null,
            expectedQualityStatus,
          }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setQualityError(data.error ?? "Could not record quality decision");
        document.getElementById(qualityErrorId)?.focus();
        return;
      }
      router.refresh();
    } catch {
      setQualityError("Could not record quality decision");
      document.getElementById(qualityErrorId)?.focus();
    } finally {
      setQualityPending(false);
    }
  }

  return (
    <div className="space-y-10">
      <form
        onSubmit={onWorkflowSubmit}
        className="max-w-2xl space-y-5"
        noValidate
        aria-labelledby="evidence-workflow-heading"
      >
        <div>
          <h3
            id="evidence-workflow-heading"
            className="font-heading text-lg text-foreground"
          >
            Evidence workflow decision
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Independent from evidence quality. Submitting this form does not
            submit a quality decision.
          </p>
        </div>

        {workflowError ? (
          <div
            id={workflowErrorId}
            tabIndex={-1}
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {workflowError}
          </div>
        ) : null}

        {!canWorkflowReview ? (
          <p className="text-sm text-muted-foreground">
            Initial workflow review is only available while evidence is
            submitted. Current state:{" "}
            <span className="font-medium text-foreground">
              {expectedWorkflowState.replaceAll("_", " ")}
            </span>
            .
          </p>
        ) : (
          <>
            <label className="block space-y-2 text-sm">
              <span>Workflow decision</span>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                value={workflowDecision}
                onChange={(event) =>
                  setWorkflowDecision(
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
                value={workflowRationale}
                onChange={(event) => setWorkflowRationale(event.target.value)}
                aria-describedby={workflowHelpId}
                required
                minLength={8}
                maxLength={4000}
              />
              <span
                id={workflowHelpId}
                className="block text-xs text-muted-foreground"
              >
                May become visitor-visible after publication. Does not establish
                whether a linked claim is true.
              </span>
            </label>

            <label className="block space-y-2 text-sm">
              <span>Private reviewer notes (optional)</span>
              <textarea
                className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2"
                value={workflowNotes}
                onChange={(event) => setWorkflowNotes(event.target.value)}
                maxLength={4000}
              />
            </label>

            {workflowDecision === "rejected" ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmRejected}
                  onChange={(event) => setConfirmRejected(event.target.checked)}
                />
                <span>
                  I confirm this terminal rejected workflow decision.
                </span>
              </label>
            ) : null}

            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              disabled={workflowPending}
              aria-busy={workflowPending}
            >
              {workflowPending ? "Recording…" : "Record workflow review"}
            </button>
          </>
        )}
      </form>

      <form
        onSubmit={onQualitySubmit}
        className="max-w-2xl space-y-5"
        noValidate
        aria-labelledby="evidence-quality-heading"
      >
        <div>
          <h3
            id="evidence-quality-heading"
            className="font-heading text-lg text-foreground"
          >
            Evidence quality decision
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Quality is independent of workflow acceptance, popularity, and later
            consultation agreement. A quality label does not prove a claim is
            true. Submitting this form does not submit a workflow decision.
          </p>
        </div>

        {qualityError ? (
          <div
            id={qualityErrorId}
            tabIndex={-1}
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {qualityError}
          </div>
        ) : null}

        <label className="block space-y-2 text-sm">
          <span>Quality status</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={qualityStatus}
            onChange={(event) =>
              setQualityStatus(
                event.target.value as
                  | "accepted"
                  | "limited"
                  | "disputed"
                  | "rejected",
              )
            }
            required
          >
            <option value="accepted">Accepted</option>
            <option value="limited">Limited</option>
            <option value="disputed">Disputed</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        <label className="block space-y-2 text-sm">
          <span>Public rationale (required)</span>
          <textarea
            className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2"
            value={qualityRationale}
            onChange={(event) => setQualityRationale(event.target.value)}
            aria-describedby={qualityHelpId}
            required
            minLength={8}
            maxLength={4000}
          />
          <span
            id={qualityHelpId}
            className="block text-xs text-muted-foreground"
          >
            Pending is not a completing choice. Current expected status:{" "}
            {expectedQualityStatus}.
          </span>
        </label>

        <label className="block space-y-2 text-sm">
          <span>Private reviewer notes (optional)</span>
          <textarea
            className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2"
            value={qualityNotes}
            onChange={(event) => setQualityNotes(event.target.value)}
            maxLength={4000}
          />
        </label>

        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          disabled={qualityPending}
          aria-busy={qualityPending}
        >
          {qualityPending ? "Recording…" : "Record quality decision"}
        </button>
      </form>
    </div>
  );
}
