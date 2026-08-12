"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

type EditableSubject = {
  kind: "claim" | "evidence";
  id: string;
  workflowState: string;
  expectedUpdatedAt: string;
};

type SubmissionEditResubmitFormProps = {
  claimId: string;
  evidenceSubmissionId: string;
  claimEditable: boolean;
  evidenceEditable: boolean;
  claimResubmittable: boolean;
  evidenceResubmittable: boolean;
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

/**
 * Envelope-shaped UI that still mutates claim and evidence independently
 * with explicit subject IDs (never links[0] inference on the server).
 */
export function SubmissionEditResubmitForm({
  claimId,
  evidenceSubmissionId,
  claimEditable,
  evidenceEditable,
  claimResubmittable,
  evidenceResubmittable,
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

  async function saveSubjects() {
    if (claimEditable) {
      await patch({
        action: "update",
        subject: "claim",
        expectedUpdatedAt: claimUpdatedAt,
        claimTitle,
        claimSummary,
        approachLabel,
      });
    }
    if (evidenceEditable) {
      await patch({
        action: "update",
        subject: "evidence",
        evidenceSubmissionId,
        expectedUpdatedAt: evidenceUpdatedAt,
        sourceUrl,
        evidenceTitle,
        organization,
        authorType,
        sourceType,
        limitations,
      });
    }
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      await saveSubjects();
      setStatus(
        "Saved. Content revisions are recorded for post-submission edits. You can resubmit each subject when ready.",
      );
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
      await saveSubjects();
      if (claimResubmittable) {
        await patch({ action: "resubmit", subject: "claim" });
      }
      if (evidenceResubmittable) {
        await patch({
          action: "resubmit",
          subject: "evidence",
          evidenceSubmissionId,
        });
      }
      setStatus("Resubmitted eligible subjects for staff review.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resubmit");
      document.getElementById(errorId)?.focus();
    } finally {
      setPending(false);
    }
  }

  const canSave = claimEditable || evidenceEditable;
  const canResubmit = claimResubmittable || evidenceResubmittable;

  return (
    <form onSubmit={onSave} className="max-w-2xl space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        Claim and evidence are edited independently. A claim-only changes
        request does not require resubmitting evidence. Source URLs are stored
        but never fetched.
      </p>
      {error ? (
        <div
          id={errorId}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
          <span className="mt-1 block text-xs">
            If another edit happened first, reload this page and try again.
          </span>
        </div>
      ) : null}
      {status ? (
        <p className="text-sm text-foreground" role="status">
          {status}
        </p>
      ) : null}

      {claimEditable ? (
        <fieldset className="space-y-4">
          <legend className="font-medium text-foreground">Claim content</legend>
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
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">
          Claim is not editable in its current workflow state.
        </p>
      )}

      {evidenceEditable ? (
        <fieldset className="space-y-4">
          <legend className="font-medium text-foreground">
            Evidence content
          </legend>
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
              type="url"
              inputMode="url"
              maxLength={2000}
              className="w-full break-all rounded-md border border-border bg-background px-3 py-2 text-base"
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
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">
          Evidence is not editable in its current workflow state.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 text-sm font-medium disabled:opacity-60"
          disabled={pending || !canSave}
        >
          {pending ? "Working…" : "Save edits"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          disabled={pending || !canResubmit}
          onClick={onResubmit}
        >
          Save and resubmit eligible subjects
        </button>
      </div>
    </form>
  );
}

export type { EditableSubject };
