"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Props = {
  claimId: string;
  evidenceSubmissionId: string | null;
  claimWorkflowState: string;
  evidenceWorkflowState: string | null;
  canWithdrawClaim: boolean;
  canWithdrawEvidence: boolean;
};

export function SubmissionWithdrawControls({
  claimId,
  evidenceSubmissionId,
  claimWorkflowState,
  evidenceWorkflowState,
  canWithdrawClaim,
  canWithdrawEvidence,
}: Props) {
  const router = useRouter();
  const errorId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canWithdrawClaim && !canWithdrawEvidence) {
    return (
      <p className="text-sm text-muted-foreground">
        Neither the claim nor linked evidence can be withdrawn in its current
        state.
      </p>
    );
  }

  async function withdraw(subject: "claim" | "evidence") {
    setPending(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        action: "withdraw",
        subject,
        reason: reason || undefined,
      };
      if (subject === "claim") {
        body.expectedWorkflowState = claimWorkflowState;
      } else {
        if (!evidenceSubmissionId || !evidenceWorkflowState) {
          throw new Error("Evidence subject is not available");
        }
        body.evidenceSubmissionId = evidenceSubmissionId;
        body.expectedWorkflowState = evidenceWorkflowState;
      }

      const response = await fetch(`/api/workspace/submissions/${claimId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not withdraw");
        document.getElementById(errorId)?.focus();
        return;
      }
      router.refresh();
    } catch {
      setError("Could not withdraw");
      document.getElementById(errorId)?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      {error ? (
        <div
          id={errorId}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      <label className="block space-y-2 text-sm">
        <span>Withdrawal note (optional)</span>
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || !canWithdrawClaim}
          onClick={() => void withdraw("claim")}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm disabled:opacity-60"
        >
          {pending ? "Working…" : "Withdraw claim only"}
        </button>
        <button
          type="button"
          disabled={pending || !canWithdrawEvidence || !evidenceSubmissionId}
          onClick={() => void withdraw("evidence")}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm disabled:opacity-60"
        >
          {pending ? "Working…" : "Withdraw evidence only"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Withdrawal is subject-specific. Linked counterparts and revision history
        are retained; nothing is deleted.
      </p>
    </div>
  );
}
