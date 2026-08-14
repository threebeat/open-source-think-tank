"use client";

import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MembershipCorrectionForm() {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/account/membership-correction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setMessage("Correction or appeal recorded. Transfer is not available in this phase.");
      setReason("");
    } catch {
      setError("Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      <label className="block space-y-2 text-sm">
        <span>Correction or appeal reason</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2"
          required
          minLength={8}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={cn(buttonVariants({ size: "lg" }), "min-h-11 disabled:opacity-50")}
      >
        {pending ? "Recording…" : "Request correction or appeal"}
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
