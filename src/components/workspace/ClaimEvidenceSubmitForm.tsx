"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type SubmissionFormProps = {
  topicId: string;
  topicTitle: string;
};

type FieldErrors = { form?: string };

export function ClaimEvidenceSubmitForm({
  topicId,
  topicTitle,
}: SubmissionFormProps) {
  const router = useRouter();
  const errorSummaryId = useId();
  const [claimTitle, setClaimTitle] = useState("");
  const [claimSummary, setClaimSummary] = useState("");
  const [approachLabel, setApproachLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [authorType, setAuthorType] = useState("researcher");
  const [sourceType, setSourceType] = useState("report");
  const [limitations, setLimitations] = useState("");
  const [relationship, setRelationship] = useState<
    "supporting" | "counterevidence"
  >("supporting");
  const [disclosureChoice, setDisclosureChoice] = useState<"none" | "disclose">(
    "none",
  );
  const [disclosurePublicSummary, setDisclosurePublicSummary] = useState("");
  const [disclosurePrivateDetail, setDisclosurePrivateDetail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const response = await fetch(
        `/api/workspace/topics/${topicId}/submissions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            claimTitle,
            claimSummary,
            approachLabel,
            sourceUrl,
            evidenceTitle,
            organization,
            authorType,
            sourceType,
            limitations,
            relationship,
            disclosureChoice,
            disclosurePublicSummary:
              disclosureChoice === "disclose"
                ? disclosurePublicSummary
                : undefined,
            disclosurePrivateDetail:
              disclosureChoice === "disclose"
                ? disclosurePrivateDetail || null
                : null,
          }),
        },
      );
      const data = (await response.json()) as {
        error?: string;
        claim?: { id: string };
      };
      if (!response.ok) {
        setErrors({ form: data.error ?? "Could not submit" });
        document.getElementById(errorSummaryId)?.focus();
        return;
      }
      router.push("/workspace/submissions");
      router.refresh();
    } catch {
      setErrors({ form: "Could not submit" });
      document.getElementById(errorSummaryId)?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5" noValidate>
      <p className="text-sm text-muted-foreground">
        Submitting to <span className="font-medium text-foreground">{topicTitle}</span>.
        Submissions are staff-visible and not visitor-public until a later
        reviewed publication step. Source URLs are recorded but never fetched by
        this application.
      </p>

      {errors.form ? (
        <div
          id={errorSummaryId}
          tabIndex={-1}
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {errors.form}
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="font-medium">Claim</legend>
        <label className="block space-y-2 text-sm">
          <span>Claim title</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={claimTitle}
            maxLength={200}
            required
            onChange={(event) => setClaimTitle(event.target.value)}
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Claim summary</span>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            rows={4}
            value={claimSummary}
            maxLength={4000}
            required
            onChange={(event) => setClaimSummary(event.target.value)}
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Approach label</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={approachLabel}
            maxLength={200}
            required
            onChange={(event) => setApproachLabel(event.target.value)}
          />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium">Evidence source</legend>
        <p className="text-xs text-muted-foreground">
          A source&apos;s later review status is independent of popularity and is
          not proof that a claim is true.
        </p>
        <label className="block space-y-2 text-sm">
          <span>Source URL (http or https only)</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            type="url"
            value={sourceUrl}
            maxLength={2000}
            required
            onChange={(event) => setSourceUrl(event.target.value)}
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Evidence title</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={evidenceTitle}
            maxLength={200}
            required
            onChange={(event) => setEvidenceTitle(event.target.value)}
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Organization</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={organization}
            maxLength={200}
            required
            onChange={(event) => setOrganization(event.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm">
            <span>Author type</span>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={authorType}
              onChange={(event) => setAuthorType(event.target.value)}
            >
              <option value="agency">Agency</option>
              <option value="researcher">Researcher</option>
              <option value="journalist">Journalist</option>
              <option value="civil_society">Civil society</option>
              <option value="industry">Industry</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span>Source type</span>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
            >
              <option value="report">Report</option>
              <option value="dataset">Dataset</option>
              <option value="peer_reviewed">Peer reviewed</option>
              <option value="news">News</option>
              <option value="memo">Memo</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <label className="block space-y-2 text-sm">
          <span>Limitations</span>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            rows={3}
            value={limitations}
            maxLength={4000}
            required
            onChange={(event) => setLimitations(event.target.value)}
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Relationship to claim</legend>
          <p className="text-xs text-muted-foreground">
            Supporting means the source supports this claim. Counterevidence
            means the source is evidence against this claim.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="relationship"
              checked={relationship === "supporting"}
              onChange={() => setRelationship("supporting")}
            />
            Supports this claim
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="relationship"
              checked={relationship === "counterevidence"}
              onChange={() => setRelationship("counterevidence")}
            />
            Evidence against this claim
          </label>
        </fieldset>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium">Conflict disclosure</legend>
        <p className="text-xs text-muted-foreground">
          Attach one disclosure to this claim. Private detail is optional and
          never shown on public projections. Do not include unnecessary sensitive
          information.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="disclosure"
            checked={disclosureChoice === "none"}
            onChange={() => setDisclosureChoice("none")}
          />
          No known conflict
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="disclosure"
            checked={disclosureChoice === "disclose"}
            onChange={() => setDisclosureChoice("disclose")}
          />
          I have a conflict to disclose
        </label>
        {disclosureChoice === "disclose" ? (
          <>
            <label className="block space-y-2 text-sm">
              <span>Public summary</span>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                rows={3}
                value={disclosurePublicSummary}
                maxLength={1000}
                required
                onChange={(event) =>
                  setDisclosurePublicSummary(event.target.value)
                }
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span>Private detail (optional)</span>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                rows={3}
                value={disclosurePrivateDetail}
                maxLength={4000}
                onChange={(event) =>
                  setDisclosurePrivateDetail(event.target.value)
                }
              />
            </label>
          </>
        ) : null}
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm text-background disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit claim and evidence"}
      </button>
    </form>
  );
}
