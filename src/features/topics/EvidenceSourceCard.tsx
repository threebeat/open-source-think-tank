import { EvidenceDisclosure } from "@/features/topics/EvidenceDisclosure";
import {
  linkedClaimsForFixtureSource,
  mapFixtureEvidenceToDisclosure,
  primaryRelationshipForFixtureSource,
} from "@/features/topics/map-evidence-disclosure";
import type { Claim, EvidenceSource } from "@/domain/types";
import type { EvidenceDisclosureRelationship } from "@/features/topics/evidence-disclosure-model";

type EvidenceSourceCardProps = {
  source: EvidenceSource;
  /** Optional override when rendering under a single claim. */
  relationship?: EvidenceDisclosureRelationship;
  claims?: Claim[];
  /** Set false when the same source is also rendered in the topic inventory. */
  anchor?: boolean;
};

/**
 * Public-demo evidence card — progressive disclosure wrapper.
 * Full source details stay collapsed until the visitor expands the item.
 */
export function EvidenceSourceCard({
  source,
  relationship,
  claims = [],
  anchor = true,
}: EvidenceSourceCardProps) {
  const resolvedRelationship =
    relationship ?? primaryRelationshipForFixtureSource(source.id, claims);
  const item = mapFixtureEvidenceToDisclosure({
    source,
    relationship: resolvedRelationship,
    linkedClaims: linkedClaimsForFixtureSource(source.id, claims),
  });

  return <EvidenceDisclosure item={item} anchor={anchor} />;
}
