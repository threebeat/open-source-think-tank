"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

type SubmissionEditResubmitFormProps = {
  claimId: string;
  initialClaimTitle: string;
  initialClaimSummary: string;
  initialApproachLabel: string;
  initialSourceUrl: string;
  initialEvidenceTitle: string;
  initialOrganization: string;
  initialAuthorType: string;
  initialSourceType: string;
  initialLimitations: string;
  expectedClaimUpdatedAt: string;
  expectedEvidenceUpdatedAt: string;
};

export function SubmissionEditResubmitForm({
  claimId,
  initialClaimTitle,
  initialClaimSummary,
  initialApproachLabel,
  initialSourceUrl,
  initialEvidenceTitle,
  initialOrganization,
  initialAuthorType,
  initialSourceType,
  initialLimitations,
  expectedClaimUpdatedAt,
  expectedEvidenceUpdatedAt,
}: SubmissionEditResubmitFormProps) {
  const router = useRouter();
  const errorId = useId();
  const [claimTitle, setClaimTitle] = useState(initialClaimTitle);
  const [claimSummary, setClaimSummary] = useState(initialClaimSummary);
  const [approachLabel, setApproachLabel] = useState(initialApproachLabel);
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [evidenceTitle, setEvidenceTitle] = useState(initialEvidenceTitle);
  const [organization, setOrganization] = useState(initialOrganization);
  const authorType = initialAuthorType;
  const sourceType = initialSourceType;
  const [limitations, setLimitations] = useState(initialLimitations);
  const [claimUpdatedAt, setClaimUpdatedAt] = useState(expectedClaimUpdatedAt);
  const [evidenceUpdatedAt, setEvidenceUpdatedAt] = useState(
    expectedEvidenceUpdatedAt,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    const response = await fetch(`/api/workspace/submissions/${claimId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as {
      error?: string;
      claim?: { updatedAt: string };
      evidence?: { updatedAt: string };
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Request failed");
    }
    if (data.claim?.updatedAt) setClaimUpdatedAt(data.claim.updatedAt);
    if (data.evidence?.updatedAt) setEvidenceUpdatedAt(data.evidence.updatedAt);
    return data;
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      await patch({
        action: "update",
        expectedClaimUpdatedAt: claimUpdatedAt,
        expectedEvidenceUpdatedAt: evidenceUpdatedAt,
        claimTitle,
        claimSummary,
        approachLabel,
        sourceUrl,
        evidenceTitle,
        organization,
        authorType,
        sourceType,
        limitations,
      });
      setStatus("Saved. You can resubmit when ready.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      document.getElementById(errorId)?.focus();
    } finally {
      setPending(false);
    }
  }

  async function onResubmit() {
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      await patch({
        action: "update",
        expectedClaimUpdatedAt: claimUpdatedAt,
        expectedEvidenceUpdatedAt: evidenceUpdatedAt,
        claimTitle,
        claimSummary,
        approachLabel,
        sourceUrl,
        evidenceTitle,
        organization,
        authorType,
        sourceType,
        limitations,
      });
      await patch({ action: "resubmit" });
      setStatus("Resubmitted for staff review.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resubmit");
      document.getElementById(errorId)?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSave} className="max-w-2xl space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        Edit your claim and evidence, then resubmit for another review. Source
        URLs are stored but never fetched.
      </p>
      {error ? (
        <div
          id={errorId}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      {status ? (
        <p className="text-sm text-foreground" role="status">
          {status}
        </p>
      ) : null}

      <label className="block space-y-2 text-sm">
        <span>Claim title</span>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          value={claimTitle}
          onChange={(event) => setClaimTitle(event.target.value)}
          required
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Claim summary</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2"
          value={claimSummary}
          onChange={(event) => setClaimSummary(event.target.value)}
          required
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Approach label</span>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          value={approachLabel}
          onChange={(event) => setApproachLabel(event.target.value)}
          required
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Evidence title</span>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          value={evidenceTitle}
          onChange={(event) => setEvidenceTitle(event.target.value)}
          required
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Source URL</span>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          required
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Organization</span>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          value={organization}
          onChange={(event) => setOrganization(event.target.value)}
          required
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Limitations</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2"
          value={limitations}
          onChange={(event) => setLimitations(event.target.value)}
          required
        />
      </label>
      <input type="hidden" value={authorType} readOnly />
      <input type="hidden" value={sourceType} readOnly />

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 text-sm font-medium disabled:opacity-60"
          disabled={pending}
        >
          {pending ? "Working…" : "Save edits"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          disabled={pending}
          onClick={onResubmit}
        >
          Save and resubmit
        </button>
      </div>
    </form>
  );
}
