import type {
  TopicPublicationStatus,
  TopicWorkflowState,
} from "@/lib/topics/repository";

export function workflowStateLabel(state: TopicWorkflowState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "open_for_submissions":
      return "Open for submissions (operational)";
    case "under_review":
      return "Under review";
    case "paused":
      return "Paused";
    case "archived":
      return "Archived";
  }
}

export function publicationStatusLabel(status: TopicPublicationStatus): string {
  switch (status) {
    case "unpublished":
      return "Not published";
    case "published":
      return "Published";
  }
}

export function publicationStatusHelp(status: TopicPublicationStatus): string {
  if (status === "unpublished") {
    return "Visitors cannot see this topic in the gated public interface.";
  }
  return "A public projection exists; operational pause or archive does not unpublish.";
}
