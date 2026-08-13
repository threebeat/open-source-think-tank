import {
  ideaCommonsPosts,
  journeyTrajectories,
  type IdeaCommonsKind,
} from "@/fixtures/journey-catalog";

export type DiscussionRelationshipKind =
  | "origin"
  | "related"
  | "merged"
  | "split"
  | "follow-up"
  | "superseded";

export type PublicDiscussionRelationship = {
  id: string;
  synthetic: true;
  title: string;
  summary: string;
  kind: IdeaCommonsKind;
  relationship: DiscussionRelationshipKind;
  lifecycleState: "informal" | "merged" | "deferred" | "nominated";
  publicDate: string;
  /** Ordinary attribution only — never elevated ranking. */
  publicAuthorLabel: string;
  ideaCommonsHref: string;
  lineageReason: string | null;
  informalNotice: string;
};

/**
 * Allowlisted public-demo relationships from Idea Commons fixtures.
 * Gated mode must not call this for live DB topics.
 */
export function listPublicDemoDiscussionRelationships(
  formalTopicSlug: string,
): PublicDiscussionRelationship[] {
  const trajectories = journeyTrajectories.filter(
    (item) => item.formalTopicSlug === formalTopicSlug,
  );
  const results: PublicDiscussionRelationship[] = [];

  for (const trajectory of trajectories) {
    const root = ideaCommonsPosts.find(
      (post) => post.id === trajectory.ideaCommonsRootId,
    );
    if (!root) {
      continue;
    }
    const relationship: DiscussionRelationshipKind =
      trajectory.outcome === "merge_split"
        ? "merged"
        : trajectory.outcome === "deferred"
          ? "related"
          : "origin";
    const lifecycleState =
      trajectory.outcome === "merge_split"
        ? "merged"
        : trajectory.outcome === "deferred"
          ? "deferred"
          : "informal";

    results.push({
      id: `rel-${root.id}`,
      synthetic: true,
      title: root.title,
      summary: root.body,
      kind: root.kind,
      relationship,
      lifecycleState,
      publicDate: root.createdAt,
      publicAuthorLabel: root.authorLabel,
      ideaCommonsHref: `/idea-commons/${root.id}`,
      lineageReason:
        trajectory.outcome === "merge_split"
          ? "Merged into this formal topic as a scoped follow-up; history preserved."
          : trajectory.outcome === "deferred"
            ? "Linked Idea Commons proposal remains informal while a published criterion is unmet."
            : "Origin discussion that entered scoping after published criteria were met.",
      informalNotice: root.informalNotice,
    });

    const children = ideaCommonsPosts.filter(
      (post) => post.parentId === root.id && post.kind === "proposal",
    );
    for (const child of children) {
      results.push({
        id: `rel-${child.id}`,
        synthetic: true,
        title: child.title,
        summary: child.body,
        kind: child.kind,
        relationship:
          child.id === "idea-moderator-ordinary-proposal" ? "related" : "follow-up",
        lifecycleState: "informal",
        publicDate: child.createdAt,
        publicAuthorLabel: child.authorLabel,
        ideaCommonsHref: `/idea-commons/${root.id}`,
        lineageReason:
          child.id === "idea-moderator-ordinary-proposal"
            ? "Moderator-authored ordinary proposal — same presentation rules; no ranking advantage."
            : "Converted proposal still informal until published gates are met.",
        informalNotice: child.informalNotice,
      });
    }
  }

  return results;
}
