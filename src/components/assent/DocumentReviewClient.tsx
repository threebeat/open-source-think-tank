"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Presentation = {
  presentationId: string;
  documentVersionId: string;
  contentHash: string;
  title: string;
  body: string;
  kind: string;
  versionLabel: string;
  requiredNotices: string[];
  expiresAt: string;
};

export function DocumentReviewClient({
  documentVersionId,
}: {
  documentVersionId: string;
}) {
  const router = useRouter();
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [notices, setNotices] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function loadPresentation() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/assent/present", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentVersionId }),
      });
      const data = (await response.json()) as Presentation & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not open document presentation");
        return;
      }
      setPresentation(data);
      setNotices(
        Object.fromEntries(data.requiredNotices.map((notice) => [notice, false])),
      );
    } catch {
      setError("Could not open document presentation");
    } finally {
      setPending(false);
    }
  }

  async function submit(action: "assent" | "decline") {
    if (!presentation) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (action === "assent") {
        const noticesAcknowledged = Object.entries(notices)
          .filter(([, checked]) => checked)
          .map(([notice]) => notice);
        const response = await fetch("/api/assent/record", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            documentVersionId: presentation.documentVersionId,
            presentationId: presentation.presentationId,
            method: "gated-ui",
            noticesAcknowledged,
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Assent failed");
          return;
        }
      } else {
        const response = await fetch("/api/assent/decline", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            documentVersionId: presentation.documentVersionId,
            presentationId: presentation.presentationId,
            reason: "Declined after reviewing the full document.",
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Decline failed");
          return;
        }
      }
      router.push("/account/assent");
      router.refresh();
    } catch {
      setError(action === "assent" ? "Assent failed" : "Decline failed");
    } finally {
      setPending(false);
    }
  }

  if (!presentation) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Open the complete document before recording assent or decline. The
          server issues a single-use presentation; client-echoed hashes are not
          accepted.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => void loadPresentation()}
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {pending ? "Opening…" : "Present full document"}
        </button>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl">{presentation.title}</h2>
        <p className="text-sm text-muted-foreground">
          {presentation.kind} · {presentation.versionLabel}
        </p>
      </div>
      <article className="whitespace-pre-wrap text-sm leading-relaxed">
        {presentation.body}
      </article>
      {presentation.requiredNotices.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Required notices</legend>
          {presentation.requiredNotices.map((notice) => (
            <label key={notice} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(notices[notice])}
                onChange={(event) =>
                  setNotices((current) => ({
                    ...current,
                    [notice]: event.target.checked,
                  }))
                }
              />
              <span>{notice}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => void submit("assent")}
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          Record assent
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void submit("decline")}
          className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
