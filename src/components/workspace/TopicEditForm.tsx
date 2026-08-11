"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { TENNESSEE_COUNTIES } from "@/lib/geography/tennessee-counties";

type TopicEditFormProps = {
  topicId: string;
  initialTitle: string;
  initialQuestion: string;
  initialBackground: string;
  initialScope: string;
  initialJurisdictionLevel: "statewide" | "county";
  initialCountyFips: string | null;
  expectedUpdatedAt: string;
  editable: boolean;
};

export function TopicEditForm({
  topicId,
  initialTitle,
  initialQuestion,
  initialBackground,
  initialScope,
  initialJurisdictionLevel,
  initialCountyFips,
  expectedUpdatedAt,
  editable,
}: TopicEditFormProps) {
  const router = useRouter();
  const errorSummaryId = useId();
  const [title, setTitle] = useState(initialTitle);
  const [question, setQuestion] = useState(initialQuestion);
  const [background, setBackground] = useState(initialBackground);
  const [scope, setScope] = useState(initialScope);
  const [jurisdictionLevel, setJurisdictionLevel] = useState<
    "statewide" | "county"
  >(initialJurisdictionLevel);
  const [countyFips, setCountyFips] = useState(initialCountyFips ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!editable) {
    return (
      <p className="text-sm text-muted-foreground">
        Metadata editing (including geography) is limited to draft topics.
        Workflow transitions do not edit title, question, background, scope, or
        geography.
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspace/topics/${topicId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          question,
          background,
          scope,
          jurisdictionLevel,
          stateCode: "TN",
          countyFips: jurisdictionLevel === "county" ? countyFips : null,
          expectedUpdatedAt,
        }),
      });
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        if (response.status === 409) {
          setError(
            "This topic changed elsewhere. Reload the page and try again.",
          );
        } else {
          setError(data.error ?? "Could not update topic");
        }
        document.getElementById(errorSummaryId)?.focus();
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update topic");
      document.getElementById(errorSummaryId)?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4" noValidate>
      {error ? (
        <div
          id={errorSummaryId}
          tabIndex={-1}
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <label className="block space-y-2 text-sm">
        <span>Title</span>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          value={title}
          maxLength={200}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Question</span>
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          rows={3}
          value={question}
          maxLength={2000}
          required
          onChange={(event) => setQuestion(event.target.value)}
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Background</span>
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          rows={5}
          value={background}
          maxLength={8000}
          required
          onChange={(event) => setBackground(event.target.value)}
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Scope</span>
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          rows={3}
          value={scope}
          maxLength={4000}
          required
          onChange={(event) => setScope(event.target.value)}
        />
      </label>

      <fieldset className="space-y-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">
          Topic geography (classification only)
        </legend>
        <p className="text-xs text-muted-foreground">
          Changing geography does not change workflow or publication status, and
          does not grant or deny any account capability.
        </p>
        <label className="block space-y-2 text-sm">
          <span>Jurisdiction</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={jurisdictionLevel}
            onChange={(event) => {
              const next = event.target.value as "statewide" | "county";
              setJurisdictionLevel(next);
              if (next === "statewide") setCountyFips("");
            }}
          >
            <option value="statewide">Tennessee statewide</option>
            <option value="county">Tennessee county</option>
          </select>
        </label>
        {jurisdictionLevel === "county" ? (
          <label className="block space-y-2 text-sm">
            <span>County</span>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={countyFips}
              required
              onChange={(event) => setCountyFips(event.target.value)}
            >
              <option value="">Select a county</option>
              {TENNESSEE_COUNTIES.map((county) => (
                <option key={county.fips} value={county.fips}>
                  {county.name} County ({county.fips})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm text-background disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save metadata"}
      </button>
    </form>
  );
}
