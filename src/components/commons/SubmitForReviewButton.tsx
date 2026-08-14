"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SubmitForReviewButtonProps = {
  publicId: string;
};

export function SubmitForReviewButton({ publicId }: SubmitForReviewButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/commons/discussions/${encodeURIComponent(publicId)}/submit-review`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not submit for formal review.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not submit for formal review.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={onSubmit}
        className={cn(buttonVariants({ size: "lg" }), "min-h-11 disabled:opacity-50")}
      >
        {pending ? "Submitting…" : "Submit for formal review"}
      </button>
      <p className="text-sm text-muted-foreground">
        This uses the governance kernel action submit_for_formal_review. It cannot
        move the proposal to Agenda, Chamber, or Council. You cannot qualify your
        own proposal.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
