"use client";

import { useId, useState } from "react";

type StaffTopicExportControlProps = {
  topicId: string;
  topicTitle: string;
};

export function StaffTopicExportControl({
  topicId,
  topicTitle,
}: StaffTopicExportControlProps) {
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onExport() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspace/topics/${topicId}/export`);
      if (!response.ok) {
        setError("Could not download staff topic export.");
        document.getElementById(errorId)?.focus();
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] ?? "ostt-topic-export.json";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download staff topic export.");
      document.getElementById(errorId)?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="staff-topic-export">
      <p className="text-sm text-muted-foreground">
        Download an allowlisted staff package for{" "}
        <span className="text-foreground">{topicTitle}</span>. The file omits
        account IDs, private notes, private disclosure detail, and raw audit
        payloads.
      </p>
      <button
        type="button"
        onClick={onExport}
        disabled={pending}
        className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Preparing export…" : "Download staff topic export"}
      </button>
      {error ? (
        <p
          id={errorId}
          role="alert"
          tabIndex={-1}
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
