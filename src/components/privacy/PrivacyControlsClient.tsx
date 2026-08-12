"use client";

import { useId, useState } from "react";

import { RETENTION_RULES } from "@/lib/privacy/retention-rules";

type ClosureReceipt = {
  requestId: string;
  status: string;
};

/**
 * Account-holder privacy controls: own-account export link and closure request.
 * Staff legal-hold / privileged-lookup controls are intentionally absent.
 */
export function PrivacyControlsClient() {
  const errorSummaryId = useId();
  const reasonId = useId();
  const helpId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ClosureReceipt | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setReceipt(null);
    try {
      const response = await fetch("/api/account/closure-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        value?: ClosureReceipt;
      };
      if (!response.ok || !data.ok || !data.value) {
        setError(
          data.error ??
            "Could not submit the closure request. Your account was not closed.",
        );
        requestAnimationFrame(() => {
          document.getElementById(errorSummaryId)?.focus();
        });
        return;
      }
      setReceipt(data.value);
      setReason("");
    } catch {
      setError("Could not submit the closure request. Your account was not closed.");
      requestAnimationFrame(() => {
        document.getElementById(errorSummaryId)?.focus();
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="your-data-heading">
        <h2 id="your-data-heading" className="font-heading text-xl text-foreground">
          Your data
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Download a JSON export of your own account-holder records. The bundle
          is limited to your lifecycle and contact channel, profile fields,
          assent metadata and outcomes, verification case metadata (no raw
          artifacts), your conversation pseudonym mappings, and your
          closure-request records.
        </p>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          The export excludes other accounts, staff-restricted audit private
          payloads, legal-hold dockets, invitation/recovery/session secrets,
          administrator notes, and unrestricted staff search results.{" "}
          {RETENTION_RULES.export}
        </p>
        <a
          className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-base text-background underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          href="/api/account/export"
        >
          Download account-holder export (JSON)
        </a>
      </section>

      <section className="space-y-4" aria-labelledby="closure-heading">
        <h2 id="closure-heading" className="font-heading text-xl text-foreground">
          Request account closure
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Submitting a request does not close or delete your account
          immediately, and it does not guarantee deletion. An authorized
          administrator must later execute closure through dual control.{" "}
          {RETENTION_RULES.closure}
        </p>

        {receipt ? (
          <div
            className="max-w-xl space-y-2 rounded-md border border-border bg-surface-muted px-4 py-3 text-sm"
            role="status"
            aria-live="polite"
          >
            <p className="font-medium text-foreground">
              Closure request received
            </p>
            <p className="text-muted-foreground">
              Status: {receipt.status}. This is a workflow receipt only — your
              sessions remain active until an authorized closure execution.
            </p>
            <p className="font-mono text-xs break-all text-muted-foreground">
              Request id: {receipt.requestId}
            </p>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="max-w-xl space-y-4" noValidate>
          {error ? (
            <div
              id={errorSummaryId}
              tabIndex={-1}
              className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-base text-destructive"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor={reasonId} className="block text-base font-medium">
              Reason for closure or deletion request
            </label>
            <p id={helpId} className="text-sm text-muted-foreground">
              Provide a plain-language reason. Submission creates a pending
              request only; assent and audit history are retained if closure is
              later executed.
            </p>
            <textarea
              id={reasonId}
              name="reason"
              required
              minLength={1}
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby={helpId}
              aria-invalid={Boolean(error)}
              className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-base text-background disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {pending ? "Submitting…" : "Submit closure request"}
          </button>
        </form>
      </section>
    </div>
  );
}
