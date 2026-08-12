import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";

type PublicReadUnavailableProps = {
  /** Optional sanitized context — never include SQL, IDs, or secrets. */
  contextLabel?: "list" | "detail";
};

/**
 * Sanitized visitor-facing failure when a gated public read cannot complete.
 * Distinct from generic 404 for missing/unpublished topics.
 */
export function PublicReadUnavailable({
  contextLabel = "detail",
}: PublicReadUnavailableProps) {
  const title =
    contextLabel === "list"
      ? "Published topics temporarily unavailable"
      : "Publication temporarily unavailable";

  return (
    <div className="space-y-6" data-testid="public-read-unavailable">
      <PageHeader
        eyebrow="Alpha publications"
        title={title}
        description="This gated publication surface could not be loaded right now. The failure is operational — it does not mean the topic is unpublished or missing."
      />
      <DisclosureNotice title="Try again later" tone="caution">
        No database messages, configuration details, or internal identifiers are
        shown here. If the problem continues, contact the alpha operators
        through the invite channel used for this environment.
      </DisclosureNotice>
    </div>
  );
}
