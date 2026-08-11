"use client";

import { useId, useMemo, useState } from "react";

export type ComparableEvidenceItem = {
  key: string;
  relationship: "supporting" | "counterevidence";
  title: string;
  organization: string;
  authorType: string;
  sourceType: string;
  limitations: string;
  qualityStatus: string;
  qualityPlainLanguage: string;
  qualityPublicRationale: string | null;
  workflowPublicRationale: string | null;
  /** Optional: fixture demo sources may omit a live URL. */
  sourceUrl?: string | null;
  revisionSummaryLabel?: string | null;
};

type EvidenceComparisonProps = {
  claimTitle: string;
  items: ComparableEvidenceItem[];
};

function relationshipLabel(
  relationship: "supporting" | "counterevidence",
): string {
  return relationship === "supporting"
    ? "Supporting evidence"
    : "Counterevidence";
}

/**
 * Local-only two-source comparison. Does not persist, rank, or recommend.
 * Data-source neutral: works with gated projections or fixture DTOs.
 */
export function EvidenceComparison({
  claimTitle,
  items,
}: EvidenceComparisonProps) {
  const statusId = useId();
  const groupName = useId();
  const [selected, setSelected] = useState<string[]>([]);

  const canCompare = items.length >= 2;

  const selectedItems = useMemo(
    () =>
      selected
        .map((key) => items.find((item) => item.key === key))
        .filter((item): item is ComparableEvidenceItem => Boolean(item)),
    [items, selected],
  );

  function toggle(key: string) {
    setSelected((current) => {
      if (current.includes(key)) {
        return current.filter((value) => value !== key);
      }
      if (current.length >= 2) {
        return [current[1]!, key];
      }
      return [...current, key];
    });
  }

  function clearSelection() {
    setSelected([]);
  }

  if (!canCompare) {
    return null;
  }

  return (
    <section
      className="space-y-3"
      aria-labelledby={`${groupName}-compare-heading`}
    >
      <h4
        id={`${groupName}-compare-heading`}
        className="text-sm font-medium text-foreground"
      >
        Compare two sources
      </h4>
      <p className="text-sm text-muted-foreground">
        Select exactly two linked sources for “{claimTitle}”. Comparison is a
        local reading aid only — it does not rank sources, declare a winner, or
        change stored data.
      </p>

      <fieldset className="space-y-2">
        <legend className="sr-only">Sources to compare</legend>
        <ul className="space-y-2">
          {items.map((item) => {
            const checked = selected.includes(item.key);
            const disabled = !checked && selected.length >= 2;
            return (
              <li key={item.key}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
                  <input
                    type="checkbox"
                    className="mt-1"
                    name={`${groupName}-compare`}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(item.key)}
                    aria-describedby={statusId}
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="block text-muted-foreground">
                      {relationshipLabel(item.relationship)} ·{" "}
                      {item.organization}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <p id={statusId} className="text-sm text-muted-foreground" role="status">
        {selected.length === 0
          ? "No sources selected."
          : selected.length === 1
            ? "One source selected. Select one more to compare."
            : `Comparing “${selectedItems[0]?.title ?? ""}” and “${selectedItems[1]?.title ?? ""}”.`}
      </p>

      {selected.length > 0 ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm"
          onClick={clearSelection}
        >
          Clear comparison selection
        </button>
      ) : null}

      {selectedItems.length === 2 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {selectedItems.map((item) => (
            <article
              key={item.key}
              className="min-w-0 space-y-2 border-t border-border pt-3 text-sm"
            >
              <h5 className="font-heading text-base text-foreground break-words">
                {item.title}
              </h5>
              <dl className="space-y-2">
                <div>
                  <dt className="font-medium text-foreground">Relationship</dt>
                  <dd className="text-muted-foreground break-words">
                    {relationshipLabel(item.relationship)}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Organization</dt>
                  <dd className="text-muted-foreground break-words">
                    {item.organization}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Author type</dt>
                  <dd className="text-muted-foreground">{item.authorType}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Source type</dt>
                  <dd className="text-muted-foreground">{item.sourceType}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">
                    Evidence quality
                  </dt>
                  <dd className="text-muted-foreground break-words">
                    {item.qualityStatus.replaceAll("_", " ")}.{" "}
                    {item.qualityPlainLanguage}
                  </dd>
                </div>
                {item.qualityPublicRationale ? (
                  <div>
                    <dt className="font-medium text-foreground">
                      Quality rationale
                    </dt>
                    <dd className="text-muted-foreground break-words whitespace-pre-wrap">
                      {item.qualityPublicRationale}
                    </dd>
                  </div>
                ) : null}
                {item.workflowPublicRationale ? (
                  <div>
                    <dt className="font-medium text-foreground">
                      Review decision (public)
                    </dt>
                    <dd className="text-muted-foreground break-words whitespace-pre-wrap">
                      {item.workflowPublicRationale}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="font-medium text-foreground">Limitations</dt>
                  <dd className="text-muted-foreground break-words whitespace-pre-wrap">
                    {item.limitations}
                  </dd>
                </div>
                {item.revisionSummaryLabel ? (
                  <div>
                    <dt className="font-medium text-foreground">Revision</dt>
                    <dd className="text-muted-foreground break-words">
                      {item.revisionSummaryLabel}
                    </dd>
                  </div>
                ) : null}
                {item.sourceUrl ? (
                  <div>
                    <dt className="font-medium text-foreground">Source URL</dt>
                    <dd>
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-primary underline"
                      >
                        {item.sourceUrl}
                      </a>
                      <span className="block text-xs text-muted-foreground">
                        External link — not fetched by this application.
                      </span>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function groupEvidenceByRelationship<T extends { relationship: string }>(
  items: T[],
): { supporting: T[]; counterevidence: T[] } {
  return {
    supporting: items.filter((item) => item.relationship === "supporting"),
    counterevidence: items.filter(
      (item) => item.relationship === "counterevidence",
    ),
  };
}
