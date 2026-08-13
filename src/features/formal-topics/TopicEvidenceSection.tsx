import { DisclosureNotice } from "@/components/DisclosureNotice";
import { GatedPublicTopicView } from "@/components/topics/GatedPublicTopicView";
import type { CanonicalTopicViewModel } from "@/features/formal-topics/canonical-topic-model";
import { ClaimCard } from "@/features/topics/ClaimCard";
import { EvidenceInventory } from "@/features/topics/EvidenceInventory";
import { EvidenceReviewExplainer } from "@/features/topics/EvidenceReviewExplainer";

type Props = {
  model: CanonicalTopicViewModel;
};

export function TopicEvidenceSection({ model }: Props) {
  if (model.lane === "gated") {
    if (!model.gatedProjection) {
      return (
        <EmptyEvidence
          title="Evidence temporarily unavailable"
          body="The allowlisted public projection could not be loaded for this topic."
        />
      );
    }
    if (model.gatedProjection.evidence.length === 0) {
      return (
        <div className="space-y-4">
          <EmptyEvidence
            title="No publication-eligible evidence"
            body="Evidence may exist privately or in-flight, but nothing is currently eligible for the public projection."
          />
          {model.gatedProjection.withheldModerationNotices.length > 0 ? (
            <DisclosureNotice title="Public moderation notices" tone="caution">
              {model.gatedProjection.withheldModerationNotices.length} allowlisted
              withhold/restore notice(s) are attached to this publication.
            </DisclosureNotice>
          ) : null}
          <GatedPublicTopicView projection={model.gatedProjection} embedded />
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <Header />
        <DisclosureNotice title="Not a popularity ranking" tone="neutral">
          Evidence quality statuses are independent of Public Input preference
          totals and participant popularity.
        </DisclosureNotice>
        <GatedPublicTopicView projection={model.gatedProjection} embedded />
      </div>
    );
  }

  if (model.evidence.length === 0) {
    return (
      <EmptyEvidence
        title="No evidence submitted"
        body="This synthetic formal topic has no public evidence inventory yet."
      />
    );
  }

  const evidenceById = new Map(model.evidence.map((source) => [source.id, source]));

  return (
    <div className="space-y-8">
      <Header />
      <DisclosureNotice title="Not a popularity ranking" tone="neutral">
        Evidence quality statuses are independent of Public Input preference
        totals and participant popularity.
      </DisclosureNotice>
      <EvidenceReviewExplainer />
      <section className="space-y-4" aria-labelledby="claims-heading">
        <h3 id="claims-heading" className="font-heading text-xl text-foreground">
          Claims and approaches
        </h3>
        <div className="space-y-4">
          {model.claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              supporting={claim.supportingEvidenceIds
                .map((id) => evidenceById.get(id))
                .filter((source) => source != null)}
              counterevidence={claim.counterEvidenceIds
                .map((id) => evidenceById.get(id))
                .filter((source) => source != null)}
            />
          ))}
        </div>
      </section>
      <EvidenceInventory sources={model.evidence} claims={model.claims} />
    </div>
  );
}

function Header() {
  return (
    <div className="space-y-2">
      <h2 className="font-heading text-2xl text-foreground">Evidence</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Complete publication-eligible evidence presentation: claims, sources,
        quality status, limitations, conflicts, revisions, and comparison tools
        where available.
      </p>
    </div>
  );
}

function EmptyEvidence({ title, body }: { title: string; body: string }) {
  return (
    <section className="space-y-3" aria-labelledby="evidence-empty-heading">
      <h2 id="evidence-empty-heading" className="font-heading text-2xl text-foreground">
        Evidence
      </h2>
      <DisclosureNotice title={title} tone="caution">
        {body}
      </DisclosureNotice>
    </section>
  );
}
