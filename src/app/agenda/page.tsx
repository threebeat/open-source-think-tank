import type { Metadata } from "next";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { AgendaItemCard } from "@/features/agenda/AgendaItemCard";
import { AGENDA_STATES } from "@/domain/status";
import { listAgendaItems } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import { agendaStateLabels } from "@/lib/evidence-labels";

export const metadata: Metadata = {
  title: "Decide What Moves Forward",
  description:
    "Synthetic explanation of how public criteria and human review decide what moves forward, with items in proposed, qualified, deferred, and rejected states.",
};

export default function AgendaPage() {
  const items = listAgendaItems(fixtureCatalog);
  const byState = AGENDA_STATES.map((state) => ({
    state,
    items: items.filter((item) => item.state === state),
  }));

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Agenda" }]}
      />
      <PageHeader
        eyebrow="Decide What Moves Forward"
        title="Decide What Moves Forward"
        description="Public criteria organize what may enter capacity-limited policy drafting. Algorithms recommend; humans record a reasoned review. No single popularity score decides what moves forward."
      />

      <DisclosureNotice title="How deciding what moves forward works">
        A public-input snapshot (from eligible/invited participants in the intended
        product) is checked against separate public criteria: participation
        coverage, cross-group support, disagreement or salience, and enough
        research to move forward. Representation warnings stay visible and are not
        treated as a population mandate. A human reviewer then qualifies, defers,
        rejects, or leaves an item proposed. Departures from the default
        calculation are written into the public review record.
      </DisclosureNotice>

      {byState.map(({ state, items: stateItems }) => (
        <section
          key={state}
          className="space-y-4"
          aria-labelledby={`agenda-state-${state}`}
        >
          <h2
            id={`agenda-state-${state}`}
            className="font-heading text-2xl text-foreground"
          >
            {agendaStateLabels[state]}
          </h2>
          {stateItems.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {stateItems.map((item) => (
                <AgendaItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border bg-surface p-5 text-sm text-muted-foreground">
              No synthetic items in the {agendaStateLabels[state].toLowerCase()}{" "}
              state in this fixture set.
            </p>
          )}
        </section>
      ))}
    </MainContainer>
  );
}
