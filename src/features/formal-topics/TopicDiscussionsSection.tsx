import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import type { CanonicalTopicViewModel } from "@/features/formal-topics/canonical-topic-model";

type Props = {
  model: CanonicalTopicViewModel;
};

export function TopicDiscussionsSection({ model }: Props) {
  return (
    <section className="space-y-4" aria-labelledby="discussions-heading">
      <h2 id="discussions-heading" className="font-heading text-2xl text-foreground">
        Discussions &amp; Proposals
      </h2>
      <DisclosureNotice title="Idea Commons remains informal" tone="caution">
        Linked Idea Commons material is informal even when shown from a formal
        topic. A relevant proposal is not automatically adopted. Merged or split
        proposals preserve visible lineage. Moderator-authored proposals use the
        same ordinary contribution presentation with no ranking advantage.
      </DisclosureNotice>

      {model.discussionsUnavailableReason ? (
        <DisclosureNotice title="Not yet operational" tone="neutral">
          {model.discussionsUnavailableReason}
        </DisclosureNotice>
      ) : null}

      {model.discussions.length === 0 && !model.discussionsUnavailableReason ? (
        <p className="text-sm text-muted-foreground">
          No public discussion or proposal relationships are linked to this topic.
        </p>
      ) : null}

      <ul className="space-y-4">
        {model.discussions.map((item) => (
          <li
            key={item.id}
            className="space-y-2 rounded-md border border-border px-4 py-4"
          >
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              Idea Commons · {item.kind} · {item.relationship} · {item.lifecycleState}
            </p>
            <h3 className="font-heading text-lg text-foreground">
              <Link
                href={item.ideaCommonsHref}
                className="underline-offset-4 hover:underline"
              >
                {item.title}
              </Link>
            </h3>
            <p className="text-sm text-muted-foreground">{item.summary}</p>
            <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <dt className="font-medium text-foreground">Public date</dt>
                <dd>{item.publicDate}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Author label</dt>
                <dd>{item.publicAuthorLabel}</dd>
              </div>
              {item.lineageReason ? (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-foreground">Lineage reason</dt>
                  <dd>{item.lineageReason}</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-xs text-muted-foreground">{item.informalNotice}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
