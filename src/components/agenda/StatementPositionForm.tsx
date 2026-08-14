"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import type { AgendaStatementDto, MemberStatementPosition } from "@/lib/agenda/types";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: MemberStatementPosition; label: string }> = [
  { value: "agree", label: "Agree" },
  { value: "disagree", label: "Disagree" },
  { value: "pass", label: "Pass" },
];

type StatementPositionFormProps = {
  slug: string;
  statements: AgendaStatementDto[];
  canRecord: boolean;
  persist?: boolean;
};

export function StatementPositionForm({
  slug,
  statements,
  canRecord,
  persist = true,
}: StatementPositionFormProps) {
  const router = useRouter();
  const formId = useId();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, MemberStatementPosition | null>>(
    () =>
      Object.fromEntries(
        statements.map((row) => [row.publicId, row.viewerPosition]),
      ),
  );

  async function record(statementPublicId: string, position: MemberStatementPosition) {
    setPendingId(statementPublicId);
    setError(null);
    if (!persist) {
      setLocal((current) => ({ ...current, [statementPublicId]: position }));
      setPendingId(null);
      return;
    }
    try {
      const response = await fetch("/api/agenda/positions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, statementPublicId, position }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not record the position.");
        return;
      }
      setLocal((current) => ({ ...current, [statementPublicId]: position }));
      router.refresh();
    } catch {
      setError("Could not record the position.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby={`${formId}-heading`}>
      <h2 id={`${formId}-heading`} className="font-heading text-xl tracking-tight">
        In-house positions
      </h2>
      <p className="text-sm text-muted-foreground">
        These controls write only to Commonhall. They are not a live Pol.is
        consultation and do not change evidence quality.
      </p>
      {statements.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No synthetic statements are listed for this topic.
        </p>
      ) : (
        <ul className="space-y-4">
          {statements.map((statement, index) => {
            const selected = local[statement.publicId] ?? null;
            return (
              <li
                key={statement.publicId}
                className="space-y-3 rounded-md border border-border p-4"
              >
                <p className="text-sm leading-6">{statement.text}</p>
                <fieldset disabled={!canRecord || pendingId === statement.publicId}>
                  <legend className="sr-only">
                    Position on statement {index + 1}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          buttonVariants({
                            variant:
                              selected === option.value ? "default" : "outline",
                            size: "lg",
                          }),
                          "min-h-11",
                        )}
                        aria-pressed={selected === option.value}
                        onClick={() => record(statement.publicId, option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ul>
      )}
      {!canRecord ? (
        <p className="text-sm text-muted-foreground">
          Positions can be recorded only by community members while consultation
          is open. Community membership does not grant a Chamber or Council seat.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
