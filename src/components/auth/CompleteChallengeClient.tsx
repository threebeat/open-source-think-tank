"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function CompleteChallengeClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(
    token ? null : "Missing challenge token.",
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/complete-challenge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await response.json()) as { error?: string };
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setError(data.error ?? "Challenge completion failed");
          return;
        }
        router.replace("/account");
      } catch {
        if (!cancelled) {
          setError("Challenge completion failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  return <p className="text-sm text-muted-foreground">Completing sign-in…</p>;
}
