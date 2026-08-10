"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const OPENABLE_KINDS = [
  "bot_resistance",
  "contact_continuity",
  "uniqueness",
  "eligibility",
] as const;

type CaseRow = {
  kind: string;
  status: string;
  caseId: string | null;
  expiresAt: string | null;
};

export function VerificationActionsClient({ cases }: { cases: CaseRow[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof OPENABLE_KINDS)[number]>("eligibility");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const appealable = cases.filter(
    (row) =>
      row.caseId &&
      (row.status === "denied" || row.status === "revoked"),
  );

  async function openCase() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/verification/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          assertionSummary: summary,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not open case");
        return;
      }
      setSummary("");
      router.refresh();
    } catch {
      setError("Could not open case");
    } finally {
      setPending(false);
    }
  }

  async function appeal(caseId: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/verification/appeal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          reason: "Account holder requests re-review after denial or revocation.",
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Appeal failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Appeal failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="open-case-heading">
        <h2 id="open-case-heading" className="font-serif text-lg">
          Open a verification case
        </h2>
        <p className="text-sm text-muted-foreground">
          Cases are opened for your signed-in account only. Reviewers must approve
          before the assertion counts toward activation.
        </p>
        <label className="block text-sm">
          Assertion kind
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as (typeof OPENABLE_KINDS)[number])
            }
          >
            {OPENABLE_KINDS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Assertion summary
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={500}
            required
          />
        </label>
        <button
          type="button"
          disabled={pending || !summary.trim()}
          onClick={() => void openCase()}
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Open case"}
        </button>
      </section>

      {appealable.length > 0 ? (
        <section className="space-y-3" aria-labelledby="appeal-heading">
          <h2 id="appeal-heading" className="font-serif text-lg">
            Appeal a decision
          </h2>
          <ul className="space-y-2 text-sm">
            {appealable.map((row) => (
              <li key={row.caseId}>
                <span className="font-medium">{row.kind}</span> · {row.status}{" "}
                <button
                  type="button"
                  disabled={pending}
                  className="underline disabled:opacity-50"
                  onClick={() => void appeal(row.caseId!)}
                >
                  Appeal
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
