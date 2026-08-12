"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { NO_CONFLICT_SUMMARY } from "@/lib/conflicts/schemas";

type DisclosureUpsertFormProps = {
  subjectType: "claim" | "evidence";
  subjectId: string;
  initialDisclosureChoice?: "none" | "disclose";
  initialPublicSummary?: string;
  initialPrivateDetail?: string | null;
  expectedUpdatedAt?: string | null;
};

function inferChoice(
  publicSummary: string | undefined,
  privateDetail: string | null | undefined,
  explicit?: "none" | "disclose",
): "none" | "disclose" {
  if (explicit) return explicit;
  if (!publicSummary && !privateDetail) return "none";
  if (
    publicSummary === NO_CONFLICT_SUMMARY &&
    !(privateDetail && privateDetail.trim())
  ) {
    return "none";
  }
  return "disclose";
}

export function DisclosureUpsertForm({
  subjectType,
  subjectId,
  initialDisclosureChoice,
  initialPublicSummary = "",
  initialPrivateDetail = null,
  expectedUpdatedAt = null,
}: DisclosureUpsertFormProps) {
  const router = useRouter();
  const errorSummaryId = useId();
  const publicHelpId = useId();
  const privateHelpId = useId();
  const [disclosureChoice, setDisclosureChoice] = useState<"none" | "disclose">(
    () =>
      inferChoice(
        initialPublicSummary,
        initialPrivateDetail,
        initialDisclosureChoice,
      ),
  );
  const [publicSummary, setPublicSummary] = useState(
    initialPublicSummary === NO_CONFLICT_SUMMARY ? "" : initialPublicSummary,
  );
  const [privateDetail, setPrivateDetail] = useState(
    initialPrivateDetail ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const endpoint =
    subjectType === "claim"
      ? `/api/workspace/disclosures/claims/${subjectId}`
      : `/api/workspace/disclosures/evidence/${subjectId}`;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          disclosureChoice,
          publicSummary:
            disclosureChoice === "disclose" ? publicSummary : undefined,
          privateDetail:
            disclosureChoice === "disclose"
              ? privateDetail.trim()
                ? privateDetail
                : null
              : null,
          expectedUpdatedAt: expectedUpdatedAt ?? undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save conflict disclosure");
        document.getElementById(errorSummaryId)?.focus();
        return;
      }
      router.refresh();
    } catch {
      setError("Could not save conflict disclosure");
      document.getElementById(errorSummaryId)?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5" noValidate>
      <p className="text-sm text-muted-foreground">
        Public summary may appear on published topics. Private detail is for
        staff reviewers with the matching review capability and is never shown
        on visitor projections. Do not include unnecessary sensitive information.
      </p>

      {error ? (
        <div
          id={errorSummaryId}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="font-medium">Conflict disclosure choice</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="radio"
            name={`disclosure-choice-${subjectType}-${subjectId}`}
            className="size-4"
            checked={disclosureChoice === "none"}
            onChange={() => setDisclosureChoice("none")}
          />
          <span>No known conflict</span>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="radio"
            name={`disclosure-choice-${subjectType}-${subjectId}`}
            className="size-4"
            checked={disclosureChoice === "disclose"}
            onChange={() => setDisclosureChoice("disclose")}
          />
          <span>I have a conflict to disclose</span>
        </label>
      </fieldset>

      {disclosureChoice === "disclose" ? (
        <>
          <label className="block space-y-2 text-sm">
            <span>Public conflict summary (required)</span>
            <textarea
              className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-base"
              value={publicSummary}
              onChange={(event) => setPublicSummary(event.target.value)}
              aria-describedby={publicHelpId}
              required
              maxLength={1000}
            />
            <span id={publicHelpId} className="block text-xs text-muted-foreground">
              Shown to visitors if this subject is later published. Keep it
              factual and brief.
            </span>
          </label>

          <label className="block space-y-2 text-sm">
            <span>Private detail (optional, not public)</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-base"
              value={privateDetail}
              onChange={(event) => setPrivateDetail(event.target.value)}
              aria-describedby={privateHelpId}
              maxLength={4000}
            />
            <span
              id={privateHelpId}
              className="block text-xs text-muted-foreground"
            >
              Never projected to anonymous visitors. Visible only to you and
              authorized reviewers.
            </span>
          </label>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Choosing “No known conflict” stores the standard public summary and
          clears any private detail.
        </p>
      )}

      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Saving…" : "Save conflict disclosure"}
      </button>
    </form>
  );
}
