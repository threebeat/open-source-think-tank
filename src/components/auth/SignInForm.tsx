"use client";

import { useState } from "react";

export function SignInForm() {
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
      const response = await fetch("/api/auth/request-sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactChannel }),
      });
      const data = (await response.json()) as {
        error?: string;
        status?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Sign-in request failed");
        return;
      }
      setMessage(
        "If that contact channel can sign in, a one-time link was sent. Check your capture inbox in local gated mode.",
      );
    } catch {
      setError("Sign-in request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <label className="block space-y-2 text-sm">
        <span>Contact channel</span>
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
        {pending ? "Sending…" : "Email me a sign-in link"}
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
