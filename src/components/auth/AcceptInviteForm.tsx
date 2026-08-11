"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token")?.trim() ?? "";
  const [inviteToken, setInviteToken] = useState(initialToken);
  const [contactChannel, setContactChannel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteToken, contactChannel }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Invitation acceptance failed");
        return;
      }
      setMessage(
        "Invitation accepted. Complete the contact-verification link to reach pending_onboarding.",
      );
    } catch {
      setError("Invitation acceptance failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <label className="block space-y-2 text-sm">
        <span>Invitation token</span>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          name="inviteToken"
          required
          value={inviteToken}
          onChange={(event) => setInviteToken(event.target.value)}
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Contact channel (must match invitation)</span>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          type="email"
          name="contactChannel"
          autoComplete="email"
          required
          value={contactChannel}
          onChange={(event) => setContactChannel(event.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {pending ? "Accepting…" : "Accept invitation"}
      </button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
