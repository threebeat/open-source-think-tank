"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

type SearchResult = {
  entityType: "topic" | "claim" | "evidence";
  id: string;
  title: string;
  topicTitle: string | null;
  topicSlug: string | null;
  workflowLabel: string | null;
  qualityLabel: string | null;
  visibilityLabel: string | null;
  updatedAt: string;
  href: string;
};

type SearchPage = {
  query: string;
  entities: Array<"topics" | "claims" | "evidence">;
  page: number;
  pageSize: number;
  total: number;
  rangeFrom: number;
  rangeTo: number;
  hasPrevious: boolean;
  hasNext: boolean;
  results: SearchResult[];
};

const ENTITY_OPTIONS = [
  { value: "topics", label: "Topics" },
  { value: "claims", label: "Claims" },
  { value: "evidence", label: "Evidence" },
] as const;

type Props = {
  initial: SearchPage | null;
  initialError: string | null;
  initialQuery: string;
  initialEntities: string[];
};

export function WorkspaceSearchForm({
  initial,
  initialError,
  initialQuery,
  initialEntities,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError);
  const [query, setQuery] = useState(initialQuery);
  const [entities, setEntities] = useState<string[]>(
    initialEntities.length > 0
      ? initialEntities
      : ["topics", "claims", "evidence"],
  );

  function buildHref(page: number) {
    const params = new URLSearchParams();
    params.set("q", initial?.query ?? query.trim());
    params.set(
      "entities",
      (initial?.entities ?? entities).join(","),
    );
    if (initial?.pageSize) {
      params.set("pageSize", String(initial.pageSize));
    }
    if (page > 1) {
      params.set("page", String(page));
    }
    return `/workspace/search?${params.toString()}`;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      setError("Enter a search query between 2 and 100 characters.");
      return;
    }
    if (entities.length === 0) {
      setError("Select at least one entity type.");
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", trimmed);
    params.set("entities", entities.join(","));
    params.delete("page");
    startTransition(() => {
      router.push(`/workspace/search?${params.toString()}`);
    });
  }

  function toggleEntity(value: string) {
    setEntities((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="space-y-4"
        aria-labelledby="workspace-search-form-heading"
      >
        <h2 id="workspace-search-form-heading" className="sr-only">
          Search form
        </h2>
        <div className="space-y-2">
          <label htmlFor="workspace-search-q" className="block text-sm font-medium">
            Search query
          </label>
          <input
            id="workspace-search-q"
            name="q"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            minLength={2}
            maxLength={100}
            autoComplete="off"
            className="w-full max-w-xl rounded-md border border-border bg-background px-3 py-2 text-base"
            aria-describedby="workspace-search-q-hint"
          />
          <p id="workspace-search-q-hint" className="text-sm text-muted-foreground">
            2–100 characters. Results are limited to metadata you are authorized
            to open.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Entity types</legend>
          <div className="flex flex-wrap gap-4">
            {ENTITY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="inline-flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={entities.includes(option.value)}
                  onChange={() => toggleEntity(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Searching…" : "Search"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-destructive" tabIndex={-1}>
          {error}
        </p>
      ) : null}

      {initial ? (
        <section
          aria-labelledby="workspace-search-results-heading"
          className="space-y-3"
        >
          <h2
            id="workspace-search-results-heading"
            className="font-heading text-xl"
          >
            Results
          </h2>
          <p
            className="text-sm text-muted-foreground"
            aria-live="polite"
            data-testid="search-result-range"
          >
            {initial.total === 0
              ? `No matches for “${initial.query}”.`
              : `Showing ${initial.rangeFrom}–${initial.rangeTo} of ${initial.total} match${initial.total === 1 ? "" : "es"} for “${initial.query}”.`}
          </p>
          {initial.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Try a different query or entity filter. Drafts belonging to other
              participants never appear here.
            </p>
          ) : (
            <ul className="space-y-3">
              {initial.results.map((row) => (
                <li
                  key={`${row.entityType}-${row.id}`}
                  className="rounded-md border border-border bg-surface px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {row.entityType}
                  </p>
                  <Link
                    href={row.href}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {row.title}
                  </Link>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {row.topicTitle ? `Topic: ${row.topicTitle}` : null}
                    {row.workflowLabel ? ` · ${row.workflowLabel}` : null}
                    {row.qualityLabel ? ` · quality ${row.qualityLabel}` : null}
                    {row.visibilityLabel
                      ? ` · ${row.visibilityLabel}`
                      : null}{" "}
                    · Updated {new Date(row.updatedAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <nav
            aria-label="Search results pagination"
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            {initial.hasPrevious ? (
              <Link
                href={buildHref(initial.page - 1)}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium underline-offset-2 hover:underline"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground">
                Previous
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              Page {initial.page}
            </span>
            {initial.hasNext ? (
              <Link
                href={buildHref(initial.page + 1)}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium underline-offset-2 hover:underline"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground">
                Next
              </span>
            )}
          </nav>
        </section>
      ) : null}
    </div>
  );
}
