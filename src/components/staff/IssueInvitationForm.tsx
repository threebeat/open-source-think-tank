"use client";

import { useState } from "react";

type IssueResult = {
  invitationId: string;
  expiresAt: string;
  acceptanceLink: string;
  rawToken: string;
  contactRedacted: string;
};

export function IssueInvitationForm() {
  const [contact, setContact] = useState("");
  const [expiresDays, setExpiresDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    const days = Number(expiresDays);
    const expiresInMs =
      Number.isFinite(days) && days > 0
        ? Math.min(days, 30) * 24 * 60 * 60 * 1000
        : undefined;
    try {
      const response = await fetch("/api/staff/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intendedContactChannel: contact,
          expiresInMs,
        }),
      });
      const data = (await response.json()) as IssueResult & {
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Invitation issuance failed");
        return;
      }
      setResult({
        invitationId: data.invitationId,
        expiresAt: data.expiresAt,
        acceptanceLink: data.acceptanceLink,
        rawToken: data.rawToken,
        contactRedacted: data.contactRedacted,
      });
      setContact("");
    } catch {
      setError("Invitation issuance failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="max-w-lg space-y-4" noValidate>
        <div
          className="rounded-md border border-amber-foreground/25 bg-amber/40 px-4 py-3 text-sm text-amber-foreground"
          role="note"
        >
          Copy the one-time acceptance link immediately after issuance. Leaving
          or reloading this page will not recover the raw token. Do not store it
          in browser storage, screenshots, or chat logs.
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <label className="block space-y-2 text-sm">
          <span>Intended contact channel</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            type="email"
            name="intendedContactChannel"
            autoComplete="email"
            required
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Expires in (days, max 30)</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            type="number"
            name="expiresDays"
            min={1}
            max={30}
            required
            value={expiresDays}
            onChange={(event) => setExpiresDays(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm text-background disabled:opacity-60"
        >
          {pending ? "Issuing…" : "Issue invitation"}
        </button>
      </form>

      {result ? (
        <section
          className="max-w-2xl space-y-3 rounded-md border border-border bg-surface p-4"
          aria-labelledby="invite-once-heading"
        >
          <h2
            id="invite-once-heading"
            className="font-heading text-lg text-foreground"
          >
            Copy this link now
          </h2>
          <p className="text-sm text-muted-foreground">
            Invitation for {result.contactRedacted} expires{" "}
            {new Date(result.expiresAt).toLocaleString()}. Deliver out of band
            while email remains capture-only.
          </p>
          <label className="block space-y-2 text-sm">
            <span>One-time acceptance link</span>
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              readOnly
              rows={3}
              value={result.acceptanceLink}
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Raw token (also in the link)</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              readOnly
              value={result.rawToken}
            />
          </label>
        </section>
      ) : null}
    </div>
  );
}
