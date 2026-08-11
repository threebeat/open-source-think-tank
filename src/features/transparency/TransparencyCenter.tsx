import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import type { AuditEvent } from "@/domain/types";

type TransparencyCenterProps = {
  auditEvents: AuditEvent[];
};

const methodRegistry = [
  {
    id: "consultation-mock-map@0.1.0",
    label: "Areas of agreement and disagreement (mock)",
    notes:
      "Sealed synthetic Pol.is-style snapshot from eligible/invited participant input in the intended product. Preference and group labels are not research quality.",
  },
  {
    id: "evidence-review-states@0.1.0",
    label: "Research Review Status",
    notes:
      "Pending, accepted, limited, disputed, and rejected remain independent of popularity. A research review status is not proof that a claim is true.",
  },
  {
    id: "agenda-threshold-trace@0.1.0",
    label: "How this result was calculated",
    notes:
      "Separate public criteria with a plain-language explanation of how this result was calculated; no combined truth score.",
  },
] as const;

const dataClasses = [
  {
    category: "Topic briefs, claims, and evidence summaries",
    posture: "What We Publish",
    detail: "Published in the demonstration with research review status and limitations.",
  },
  {
    category: "Public-input aggregate reports",
    posture: "What We Publish",
    detail:
      "Sealed synthetic aggregates and neutrally labeled groups. Not a population sample.",
  },
  {
    category: "How results were calculated and human reviews",
    posture: "What We Publish",
    detail: "Public criteria, calculation explanations, and reasoned departures are public in the demo.",
  },
  {
    category: "Council participant display names (synthetic)",
    posture: "What We Publish",
    detail: "Fictional names only. Production identity rules remain unresolved.",
  },
  {
    category: "Identity and verification artifacts",
    posture: "What We Protect",
    detail:
      "Government ID images, biometric templates, and account recovery secrets are not collected or shown.",
  },
  {
    category: "Granular political-opinion histories",
    posture: "What We Protect",
    detail:
      "Individual statement-level vote histories are not published as public person records.",
  },
  {
    category: "Security-sensitive operational details",
    posture: "What We Protect",
    detail:
      "Credentials, private contact channels, and infra secrets stay out of the public record.",
  },
] as const;

export function TransparencyCenter({ auditEvents }: TransparencyCenterProps) {
  return (
    <div className="space-y-10">
      <DisclosureNotice title="The public record is not total exposure" tone="caution">
        Openness in this prototype means explainable institutional action. It does
        not mean publishing identity documents or granular political-opinion
        histories. Unresolved privacy and membership questions remain in the open
        and legal question lists.
      </DisclosureNotice>

      <section className="space-y-3" aria-labelledby="audit-heading">
        <h2 id="audit-heading" className="font-heading text-2xl text-foreground">
          Demonstration Activity History
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Events are fixture-ordered for demonstration. They are not a live
          production log and contain no real participant data.
        </p>
        <ol className="space-y-3">
          {auditEvents.map((event) => (
            <li
              key={event.id}
              className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{event.at}</span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {event.action}
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">{event.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Actor role: {event.actorRole} · Subject: {event.subjectType} (
                {event.subjectId})
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3" aria-labelledby="governance-heading">
        <h2
          id="governance-heading"
          className="font-heading text-2xl text-foreground"
        >
          Who Does What (demonstration framing)
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          This map shows intended roles for the prototype journey. Exact legal
          authority among councils and a governing board remains unresolved.
        </p>
        <ol className="grid gap-3 md:grid-cols-5">
          {[
            "Visitor",
            "Community participant",
            "Policy Drafting Council",
            "Policy council",
            "Governing board (authority pending counsel)",
          ].map((role, index) => (
            <li
              key={role}
              className="rounded-md border border-border bg-surface p-4 text-sm"
            >
              <p className="text-xs font-medium tracking-wide text-primary uppercase">
                Step {index + 1}
              </p>
              <p className="mt-2 font-medium text-foreground">{role}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          Algorithms organize or recommend. Humans record institutional decisions.
          See{" "}
          <Link
            href="/about"
            className="font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            About
          </Link>{" "}
          and the open/legal question docs for unsettled boundaries.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="methods-heading">
        <h2 id="methods-heading" className="font-heading text-2xl text-foreground">
          Methods and Updates
        </h2>
        <ul className="space-y-3">
          {methodRegistry.map((method) => (
            <li
              key={method.id}
              className="rounded-md border border-border bg-surface p-4 text-sm"
            >
              <p className="font-medium text-foreground">{method.label}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {method.id}
              </p>
              <p className="mt-2 text-muted-foreground">{method.notes}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="data-heading">
        <h2 id="data-heading" className="font-heading text-2xl text-foreground">
          What We Publish / What We Protect
        </h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Demonstration data classes and whether they are open or protected
            </caption>
            <thead className="bg-surface-muted text-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Data class
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Posture
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {dataClasses.map((row) => (
                <tr key={row.category} className="border-t border-border">
                  <th scope="row" className="px-4 py-3 font-medium text-foreground">
                    {row.category}
                  </th>
                  <td className="px-4 py-3 text-muted-foreground">{row.posture}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="font-heading text-2xl text-foreground">
          Prototype limitations and unresolved decisions
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>
            All people, votes, evidence, and decisions are synthetic fixtures.
          </li>
          <li>
            No real memberships, identity verification, Pol.is account, payments, or
            analytics are connected.
          </li>
          <li>
            Governing-board adoption authority, statutory membership, and production
            privacy retention rules remain unresolved.
          </li>
          <li>
            Collaborators should read repository docs{" "}
            <code className="text-foreground">docs/open-questions.md</code> and{" "}
            <code className="text-foreground">docs/legal-questions.md</code>, plus
            the in-app{" "}
            <Link
              href="/about"
              className="font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              About
            </Link>{" "}
            page. Those markdown files are not served as app routes in Phase 1.
          </li>
        </ul>
        <DisclosureNotice title="Known unresolved decisions">
          Community participant vs statutory member; whether any council outcome can
          bind a board; production sampling claims; moderation defaults; and
          redaction taxonomy remain open. The UI shows the questions rather than
          inventing settled answers.
        </DisclosureNotice>
      </section>

      <section className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/decisions/cedar-river-drought-surcharge"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
        >
          Open Cedar River recommendation & council vote
        </Link>
        <Link
          href="/deliberation/cedar-river-drought-surcharge"
          className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 font-medium text-foreground"
        >
          Open policy drafting observer view
        </Link>
      </section>
    </div>
  );
}
