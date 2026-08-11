"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Props = {
  claimId: string;
  claimWorkflowState: string;
  evidenceWorkflowState: string;
  canWithdraw: boolean;
};

export function SubmissionWithdrawControls({
  claimId,
  claimWorkflowState,
  evidenceWorkflowState,
  canWithdraw,
}: Props) {
  const router = useRouter();
  const errorId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canWithdraw) {
    return (
      <p className="text-sm text-muted-foreground">
        This submission cannot be withdrawn in its current state.
      </p>
    );
  }

  async function onWithdraw(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspace/submissions/${claimId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "withdraw",
          expectedClaimWorkflowState: claimWorkflowState,
          expectedEvidenceWorkflowState: evidenceWorkflowState,
          reason: reason || undefined,
        }),
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
    <form onSubmit={onWithdraw} className="max-w-xl space-y-3">
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
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm disabled:opacity-60"
      >
        {pending ? "Withdrawing…" : "Withdraw submission"}
      </button>
      <p className="text-xs text-muted-foreground">
        Withdrawal retains rows and history; nothing is deleted.
      </p>
    </form>
  );
}
