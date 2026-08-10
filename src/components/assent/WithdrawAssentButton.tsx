"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WithdrawAssentButton({ assentId }: { assentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/assent/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assentId,
          reason: "Withdrawn by account holder from assent history.",
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Withdrawal failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Withdrawal failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void withdraw()}
        className="text-sm underline disabled:opacity-50"
      >
        {pending ? "Withdrawing…" : "Withdraw this assent"}
      </button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
