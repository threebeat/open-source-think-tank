import { DisclosureNotice } from "@/components/DisclosureNotice";
import type { MemberActionOpportunity } from "@/fixtures/journey-catalog";

type Props = {
  opportunities: MemberActionOpportunity[];
  topicTitle: string;
};

export function MemberActionsPanel({ opportunities, topicTitle }: Props) {
  return (
    <section className="space-y-4" aria-labelledby="member-actions-heading">
      <h2
        id="member-actions-heading"
        className="font-heading text-2xl text-foreground"
      >
        Member action opportunities
      </h2>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Synthetic post-decision actions related to {topicTitle}. Recommendations
        use explicit fixture geography and interests only — never individual Public
        Input votes, inferred ideology, or hidden behavioral profiles.
      </p>
      <DisclosureNotice title="Non-personalization contract" tone="caution">
        Civic actions are not personalized from Pol.is ballots. Listing is not
        always an institutional endorsement of organizers.
      </DisclosureNotice>
      <ul className="space-y-4">
        {opportunities.map((action) => (
          <li
            key={action.id}
            className="space-y-2 rounded-md border border-border px-4 py-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-heading text-lg text-foreground">{action.title}</h3>
              <p className="text-xs uppercase tracking-wide text-primary">
                {action.status} · {action.kind}
              </p>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium">Organizer</dt>
                <dd className="text-muted-foreground">{action.organizer}</dd>
              </div>
              <div>
                <dt className="font-medium">Date / location</dt>
                <dd className="text-muted-foreground">
                  {action.dateLabel} · {action.locationLabel}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Eligibility</dt>
                <dd className="text-muted-foreground">{action.eligibility}</dd>
              </div>
              <div>
                <dt className="font-medium">Expiration / status</dt>
                <dd className="text-muted-foreground">
                  {action.status} · expires {action.expiresOn}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium">Why it is shown</dt>
                <dd className="text-muted-foreground">{action.whyShown}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium">
                  Relationship to the institutional recommendation
                </dt>
                <dd className="text-muted-foreground">
                  {action.relationshipToRecommendation}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium">Sponsorship / conflict</dt>
                <dd className="text-muted-foreground">
                  {action.sponsorshipConflict}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium">Source link</dt>
                <dd>
                  <a
                    href={action.sourceLinkHref}
                    className="text-primary underline-offset-4 hover:underline"
                    rel="nofollow noopener noreferrer"
                  >
                    {action.sourceLinkLabel}
                  </a>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium">Non-endorsement</dt>
                <dd className="text-muted-foreground">{action.nonEndorsement}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
