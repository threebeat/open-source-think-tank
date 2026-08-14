"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { COMMUNITY_STANDARDS_BODY, COMMUNITY_STANDARDS_TITLE, ENROLLMENT_MIN_FILL_MS } from "@/lib/auth/community-standards";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CreateAccountForm() {
  const router = useRouter();
  const formId = useId();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [assent, setAssent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [openedAt] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const elapsed = Date.now() - openedAt;
      if (elapsed < ENROLLMENT_MIN_FILL_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, ENROLLMENT_MIN_FILL_MS - elapsed),
        );
      }
      const response = await fetch("/api/auth/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          honeypot,
          formOpenedAt: openedAt,
          communityStandardsAssent: assent,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Enrollment failed");
        return;
      }
      router.replace("/account");
      router.refresh();
    } catch {
      setError("Enrollment failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5">
      <label className="block space-y-2 text-sm" htmlFor={`${formId}-id`}>
        <span>Identifier (email-shaped, stored locally)</span>
        <input
          id={`${formId}-id`}
          className="w-full min-h-11 rounded-md border border-border bg-background px-3 py-2"
          type="email"
          name="identifier"
          autoComplete="username"
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        This identifier is stored on the gated service. No message is sent. There
        is no email vendor in this phase.
      </p>
      <label className="block space-y-2 text-sm" htmlFor={`${formId}-password`}>
        <span>Password (at least 12 characters)</span>
        <input
          id={`${formId}-password`}
          className="w-full min-h-11 rounded-md border border-border bg-background px-3 py-2"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor={`${formId}-company`}>Company website</label>
        <input
          id={`${formId}-company`}
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>
      <fieldset className="space-y-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">{COMMUNITY_STANDARDS_TITLE}</legend>
        <p className="max-h-48 overflow-y-auto text-sm leading-6 text-muted-foreground">
          {COMMUNITY_STANDARDS_BODY}
        </p>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            className="mt-1 size-4"
            type="checkbox"
            required
            checked={assent}
            onChange={(event) => setAssent(event.target.checked)}
          />
          <span>
            I assent to these community standards. This is organization community
            membership, not nonprofit or statutory membership.
          </span>
        </label>
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className={cn(buttonVariants({ size: "lg" }), "min-h-11 disabled:opacity-50")}
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
