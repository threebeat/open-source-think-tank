import { DisclosureNotice } from "@/components/DisclosureNotice";
import { evidenceReviewExplanations } from "@/lib/evidence-labels";

export function EvidenceReviewExplainer() {
  return (
    <section className="space-y-4 rounded-md border border-border bg-surface p-5 sm:p-6">
      <h2 className="font-heading text-2xl text-foreground">
        Research Review Status
      </h2>
      <DisclosureNotice title="Popularity does not change research review status">
        Public input support, cross-group agreement, and statement popularity are
        preference signals. They do not upgrade, downgrade, or replace a research
        review status, and a research review status is not proof that a claim is
        true.
      </DisclosureNotice>
      <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
        {Object.entries(evidenceReviewExplanations).map(([status, text]) => (
          <li key={status}>
            <span className="font-medium capitalize text-foreground">
              {status}
              {": "}
            </span>
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
