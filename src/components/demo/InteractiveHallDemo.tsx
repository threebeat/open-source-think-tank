"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { AgendaTopicList } from "@/components/agenda/AgendaTopicList";
import { HostedPolisUnavailable } from "@/components/agenda/HostedPolisUnavailable";
import { StatementPositionForm } from "@/components/agenda/StatementPositionForm";
import { BodyTopicList } from "@/components/bodies/BodyTopicList";
import { RollCallTable } from "@/components/bodies/RollCallTable";
import { RosterTable } from "@/components/bodies/RosterTable";
import { CommonsCategorySection } from "@/components/commons/CommonsCategorySection";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { buttonVariants } from "@/components/ui/button";
import type { RollCallRowDto } from "@/lib/bodies/types";
import {
  DEMO_AGENDA_TOPICS,
  DEMO_CHAMBER_ROLL,
  DEMO_CHAMBER_ROSTER,
  DEMO_CHAMBER_TOPICS,
  DEMO_COMMONS,
  DEMO_COUNCIL_ROLL,
  DEMO_COUNCIL_ROSTER,
  DEMO_COUNCIL_TOPICS,
  DEMO_ORG_NAME,
  DEMO_RECOMMENDATION,
  DEMO_STATEMENTS,
  DEMO_VERDICT,
} from "@/lib/demo/pre-alpha-fixtures";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: "commons", title: "Commons", hint: "Open a post to read it." },
  { id: "agenda", title: "Public Agenda", hint: "Pick a topic, then record a position." },
  { id: "chamber", title: "Chamber", hint: "Select a seat on the roll call." },
  { id: "council", title: "Council Agenda", hint: "Open the topic, then inspect a Council seat." },
] as const;

type StageId = (typeof STAGES)[number]["id"] | "finish";

const POSITION_ORDER = ["yes", "no", "abstain", "recused", "absent"] as const;

function tallyPositions(rows: RollCallRowDto[]) {
  const counts = Object.fromEntries(POSITION_ORDER.map((key) => [key, 0])) as Record<
    (typeof POSITION_ORDER)[number],
    number
  >;
  for (const row of rows) {
    counts[row.position] += 1;
  }
  return counts;
}

function RollCallTally({
  label,
  rows,
}: {
  label: string;
  rows: RollCallRowDto[];
}) {
  const counts = tallyPositions(rows);
  const total = rows.length || 1;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-background/70 p-4" aria-label={label}>
      <h3 className="font-heading text-lg">{label}</h3>
      <ul className="grid gap-3 sm:grid-cols-5">
        {POSITION_ORDER.map((position) => (
          <li key={position} className="space-y-1">
            <p className="flex justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>{position}</span>
              <span>{counts[position]}</span>
            </p>
            <div className="demo-tally-bar">
              <div
                className="demo-tally-fill"
                style={{ width: `${(counts[position] / total) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InteractiveHallDemo() {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(0);
  const [selectedDiscussion, setSelectedDiscussion] = useState<string | null>(
    "demo-lighting-thread",
  );
  const [practiceNote, setPracticeNote] = useState("");
  const [agendaSlug, setAgendaSlug] = useState(DEMO_AGENDA_TOPICS[0]!.slug);
  const [chamberSlug, setChamberSlug] = useState(DEMO_CHAMBER_TOPICS[0]!.slug);
  const [councilSlug, setCouncilSlug] = useState(DEMO_COUNCIL_TOPICS[0]!.slug);
  const [chamberSeat, setChamberSeat] = useState<string | null>(null);
  const [councilSeat, setCouncilSeat] = useState<string | null>(null);
  const [entered, setEntered] = useState(true);
  const moved = useRef(false);

  const stage = STAGES[index];
  const atStart = index === 0;
  const finished = !stage;
  const currentId: StageId = stage?.id ?? "finish";
  const progress = finished ? 100 : ((index + 1) / (STAGES.length + 1)) * 100;

  useEffect(() => {
    if (!moved.current) {
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  function goTo(next: number) {
    moved.current = true;
    setEntered(false);
    window.setTimeout(() => {
      setIndex(next);
      setEntered(true);
    }, 160);
  }

  const selectedChamber = useMemo(
    () => DEMO_CHAMBER_ROLL.find((row) => row.memberPublicId === chamberSeat) ?? null,
    [chamberSeat],
  );
  const selectedCouncil = useMemo(
    () => DEMO_COUNCIL_ROLL.find((row) => row.memberPublicId === councilSeat) ?? null,
    [councilSeat],
  );

  return (
    <div className="space-y-8">
      <DisclosureNotice title="Live-looking demo, synthetic hall" tone="caution">
        These are the same Commons, Agenda, Chamber, and Council components
        members use after they sign in. Nothing here is a live town hall, a
        live Pol.is consultation, or statutory membership. Hosted Pol.is is
        unavailable.
      </DisclosureNotice>

      <div className="space-y-3">
        <div
          className="demo-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Demo progress"
        >
          <div className="demo-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <ol className="flex flex-wrap gap-2" aria-label="Demo stages">
          {STAGES.map((item, stepIndex) => (
            <li key={item.id}>
              <button
                type="button"
                className={cn(
                  buttonVariants({
                    variant: stepIndex === index ? "default" : "outline",
                    size: "lg",
                  }),
                  "min-h-11 demo-stage-chip",
                )}
                aria-current={stepIndex === index ? "step" : undefined}
                onClick={() => goTo(stepIndex)}
              >
                {stepIndex + 1}. {item.title}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={cn(
                buttonVariants({
                  variant: finished ? "default" : "outline",
                  size: "lg",
                }),
                "min-h-11",
              )}
              aria-current={finished ? "step" : undefined}
              onClick={() => goTo(STAGES.length)}
            >
              Finish
            </button>
          </li>
        </ol>
      </div>

      <div
        className={cn(
          "demo-stage-frame overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-8",
          entered ? "demo-stage-enter" : "opacity-0",
        )}
        data-stage={currentId}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {DEMO_ORG_NAME}
        </p>
        <h2
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className="mt-2 font-heading text-3xl tracking-tight text-foreground outline-none"
        >
          {finished
            ? "You have walked the hall"
            : `${index + 1}. ${stage.title}`}
        </h2>
        {!finished ? (
          <p
            className="demo-pulse mt-4 max-w-2xl rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-base text-foreground"
          >
            {stage.hint} This surface is interactive — try it before you
            continue.
          </p>
        ) : null}

        <div className="mt-8 space-y-8">
          {currentId === "commons" ? (
            <div className="space-y-8">
              <section className="space-y-4" aria-labelledby="demo-formal">
                <h3 id="demo-formal" className="font-heading text-2xl">
                  Formal Commons
                </h3>
                {DEMO_COMMONS.formal.map((group) => (
                  <CommonsCategorySection
                    key={group.category}
                    group={group}
                    onSelectDiscussion={setSelectedDiscussion}
                    selectedPublicId={selectedDiscussion}
                    showBody
                  />
                ))}
              </section>
              <DisclosureNotice title="Unreviewed informal content" tone="caution">
                <p>{DEMO_COMMONS.disclaimer}</p>
              </DisclosureNotice>
              <section className="space-y-4" aria-labelledby="demo-informal">
                <h3 id="demo-informal" className="font-heading text-2xl">
                  Informal Commons
                </h3>
                {DEMO_COMMONS.informal.map((group) => (
                  <CommonsCategorySection
                    key={group.category}
                    group={group}
                    onSelectDiscussion={setSelectedDiscussion}
                    selectedPublicId={selectedDiscussion}
                    showBody
                  />
                ))}
              </section>
              <label className="block max-w-xl space-y-2 text-sm">
                <span className="font-medium">Practice a reply (stays on this device)</span>
                <textarea
                  className="w-full min-h-24 rounded-md border border-border bg-background px-3 py-2"
                  value={practiceNote}
                  onChange={(event) => setPracticeNote(event.target.value)}
                  maxLength={400}
                  placeholder="Type a short reaction. It is not saved to an account."
                />
              </label>
              {practiceNote.trim() ? (
                <p className="text-sm text-primary" role="status">
                  Draft kept locally ({practiceNote.trim().length} characters).
                  Sign in to post for real.
                </p>
              ) : null}
            </div>
          ) : null}

          {currentId === "agenda" ? (
            <div className="space-y-8">
              <HostedPolisUnavailable />
              <AgendaTopicList
                topics={DEMO_AGENDA_TOPICS}
                onSelectTopic={setAgendaSlug}
                selectedSlug={agendaSlug}
              />
              <StatementPositionForm
                slug={agendaSlug}
                statements={DEMO_STATEMENTS}
                canRecord
                persist={false}
              />
            </div>
          ) : null}

          {currentId === "chamber" ? (
            <div className="space-y-8">
              <RosterTable
                caption="Synthetic Chamber roster. Seats are appointed, not granted by enrollment."
                seats={DEMO_CHAMBER_ROSTER}
              />
              <BodyTopicList
                topics={DEMO_CHAMBER_TOPICS}
                hrefBase="/chamber"
                empty="No Chamber topics."
                onSelectTopic={setChamberSlug}
                selectedSlug={chamberSlug}
              />
              <p className="text-sm leading-6">{DEMO_VERDICT.rationale}</p>
              <RollCallTally label="Chamber vote mix" rows={DEMO_CHAMBER_ROLL} />
              <RollCallTable
                caption="Chamber roll call for sidewalk repair."
                rows={DEMO_CHAMBER_ROLL}
                timezone="America/Chicago"
                onSelectRow={setChamberSeat}
                selectedMemberPublicId={chamberSeat}
              />
              {selectedChamber ? (
                <p className="text-sm" role="status">
                  {selectedChamber.displayName} recorded{" "}
                  <strong>{selectedChamber.position}</strong>. Absent is never
                  inferred from a missing seat.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click a member name to inspect their explicit seat record.
                </p>
              )}
            </div>
          ) : null}

          {currentId === "council" ? (
            <div className="space-y-8">
              <RosterTable
                caption="Synthetic Council roster."
                seats={DEMO_COUNCIL_ROSTER}
              />
              <BodyTopicList
                topics={DEMO_COUNCIL_TOPICS}
                hrefBase="/council"
                empty="No Council topics."
                onSelectTopic={setCouncilSlug}
                selectedSlug={councilSlug}
              />
              <p className="text-sm leading-6">{DEMO_RECOMMENDATION.rationale}</p>
              <RollCallTally label="Council vote mix" rows={DEMO_COUNCIL_ROLL} />
              <RollCallTable
                caption="Council roll call for sidewalk repair."
                rows={DEMO_COUNCIL_ROLL}
                timezone="America/Chicago"
                onSelectRow={setCouncilSeat}
                selectedMemberPublicId={councilSeat}
              />
              {selectedCouncil ? (
                <p className="text-sm" role="status">
                  {selectedCouncil.displayName} recorded{" "}
                  <strong>{selectedCouncil.position}</strong>.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click a Council member to see their recorded position.
                </p>
              )}
            </div>
          ) : null}

          {currentId === "finish" ? (
            <div className="space-y-6">
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                After you create an account you can post in Commons, take
                positions on Public Agenda topics, and observe Chamber and
                Council records in {DEMO_ORG_NAME}.
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {STAGES.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border bg-background/70 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.hint}</p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/join"
                  className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-5")}
                >
                  Create an account
                </Link>
                <Link
                  href="/auth/sign-in"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "min-h-11 px-5",
                  )}
                >
                  Sign in
                </Link>
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "min-h-11",
                  )}
                  onClick={() => goTo(0)}
                >
                  Replay the demo
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!finished ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11")}
            disabled={atStart}
            onClick={() => goTo(index - 1)}
          >
            Back
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ size: "lg" }), "min-h-11")}
            onClick={() => goTo(index + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
