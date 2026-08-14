"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PasswordSignInForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/password-sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Sign-in failed");
        return;
      }
      router.replace("/account");
      router.refresh();
    } catch {
      setError("Sign-in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <label className="block space-y-2 text-sm">
        <span>Identifier</span>
        <input
          className="w-full min-h-11 rounded-md border border-border bg-background px-3 py-2"
          type="email"
          name="identifier"
          autoComplete="username"
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Password</span>
        <input
          className="w-full min-h-11 rounded-md border border-border bg-background px-3 py-2"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={cn(buttonVariants({ size: "lg" }), "min-h-11 disabled:opacity-50")}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
