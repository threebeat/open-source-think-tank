"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

type TopicPublishControlsProps = {
  topicId: string;
  ready: boolean;
  blockers: Array<{ code: string; message: string }>;
  publicationStatus: string;
};

export function TopicPublishControls({
  topicId,
  ready,
  blockers,
  publicationStatus,
}: TopicPublishControlsProps) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (publicationStatus === "published") {
    return (
      <p className="text-sm text-muted-foreground">
        This topic is already published. Unpublish is out of scope for Package
        3.6. Pause or reopen never changes publication status.
      </p>
    );
  }

  async function onPublish() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspace/topics/${topicId}/publish`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedPublicationStatus: "unpublished",
          }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not publish topic");
        document.getElementById(errorId)?.focus();
        return;
      }
      router.refresh();
    } catch {
      setError("Could not publish topic");
      document.getElementById(errorId)?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Publishing is a human administrator action. Readiness organizes already
        recorded review decisions; it is not an automatic institutional judgment.
        Operational workflow is preserved exactly.
      </p>

      {blockers.length > 0 ? (
        <div className="rounded-md border border-border bg-surface px-4 py-3">
          <h3 className="text-sm font-medium text-foreground">
            Not ready to publish
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {blockers.map((blocker) => (
              <li key={`${blocker.code}:${blocker.message}`}>
                {blocker.message}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-foreground">
          Readiness check passed for a coherent accepted visible claim-and-evidence
          set.
        </p>
      )}

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

      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        disabled={!ready || pending}
        aria-busy={pending}
        onClick={onPublish}
      >
        {pending ? "Publishing…" : "Publish topic"}
      </button>
    </div>
  );
}
