import type { Claim, EvidenceSource } from "@/domain/types";
import {
  AUTHOR_TYPES,
  EVIDENCE_REVIEW_STATUSES,
  SOURCE_TYPES,
  type AuthorType,
  type EvidenceReviewStatus,
  type SourceType,
} from "@/domain/status";

export type EvidenceRelationshipFilter = "all" | "supporting" | "counterevidence";

export type EvidenceSort =
  | "original"
  | "review"
  | "published_newest"
  | "published_oldest"
  | "source_type"
  | "author_type"
  | "organization"
  | "title";

export type EvidenceInventoryState = {
  reviewStatus: "all" | EvidenceReviewStatus;
  sourceType: "all" | SourceType;
  authorType: "all" | AuthorType;
  relationship: EvidenceRelationshipFilter;
  sort: EvidenceSort;
};

export const DEFAULT_EVIDENCE_INVENTORY: EvidenceInventoryState = {
  reviewStatus: "all",
  sourceType: "all",
  authorType: "all",
  relationship: "all",
  sort: "original",
};

/**
 * Explicit category order for organization only.
 * Not a truth score and not mixed with popularity or consultation agreement.
 */
export const EVIDENCE_REVIEW_SORT_ORDER: readonly EvidenceReviewStatus[] = [
  "accepted",
  "limited",
  "pending",
  "disputed",
  "rejected",
] as const;

const REVIEW = new Set<string>(EVIDENCE_REVIEW_STATUSES);
const SOURCES = new Set<string>(SOURCE_TYPES);
const AUTHORS = new Set<string>(AUTHOR_TYPES);
const RELATIONSHIPS = new Set<EvidenceRelationshipFilter>([
  "all",
  "supporting",
  "counterevidence",
]);
const SORTS = new Set<EvidenceSort>([
  "original",
  "review",
  "published_newest",
  "published_oldest",
  "source_type",
  "author_type",
  "organization",
  "title",
]);

export type EvidenceRelationshipIndex = {
  supportingIds: Set<string>;
  counterEvidenceIds: Set<string>;
};

export function buildEvidenceRelationshipIndex(
  claims: Claim[],
): EvidenceRelationshipIndex {
  const supportingIds = new Set<string>();
  const counterEvidenceIds = new Set<string>();
  for (const claim of claims) {
    for (const id of claim.supportingEvidenceIds) {
      supportingIds.add(id);
    }
    for (const id of claim.counterEvidenceIds) {
      counterEvidenceIds.add(id);
    }
  }
  return { supportingIds, counterEvidenceIds };
}

export function parseEvidenceInventoryState(
  params: URLSearchParams,
): EvidenceInventoryState {
  const reviewRaw = params.get("evReview") ?? "all";
  const reviewStatus =
    reviewRaw === "all" || REVIEW.has(reviewRaw)
      ? (reviewRaw as "all" | EvidenceReviewStatus)
      : "all";

  const sourceRaw = params.get("evSource") ?? "all";
  const sourceType =
    sourceRaw === "all" || SOURCES.has(sourceRaw)
      ? (sourceRaw as "all" | SourceType)
      : "all";

  const authorRaw = params.get("evAuthor") ?? "all";
  const authorType =
    authorRaw === "all" || AUTHORS.has(authorRaw)
      ? (authorRaw as "all" | AuthorType)
      : "all";

  const relationshipRaw = params.get("evRel") ?? "all";
  const relationship = RELATIONSHIPS.has(
    relationshipRaw as EvidenceRelationshipFilter,
  )
    ? (relationshipRaw as EvidenceRelationshipFilter)
    : "all";

  const sortRaw = params.get("evSort") ?? "original";
  const sort = SORTS.has(sortRaw as EvidenceSort)
    ? (sortRaw as EvidenceSort)
    : "original";

  return {
    reviewStatus,
    sourceType,
    authorType,
    relationship,
    sort,
  };
}

export function evidenceInventoryToParams(
  state: EvidenceInventoryState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.reviewStatus !== "all") {
    params.set("evReview", state.reviewStatus);
  }
  if (state.sourceType !== "all") {
    params.set("evSource", state.sourceType);
  }
  if (state.authorType !== "all") {
    params.set("evAuthor", state.authorType);
  }
  if (state.relationship !== "all") {
    params.set("evRel", state.relationship);
  }
  if (state.sort !== "original") {
    params.set("evSort", state.sort);
  }
  return params;
}

export function hasActiveEvidenceFilters(state: EvidenceInventoryState): boolean {
  return (
    state.reviewStatus !== "all" ||
    state.sourceType !== "all" ||
    state.authorType !== "all" ||
    state.relationship !== "all" ||
    state.sort !== "original"
  );
}

export function filterEvidenceSources(
  sources: EvidenceSource[],
  state: EvidenceInventoryState,
  relationships: EvidenceRelationshipIndex,
): EvidenceSource[] {
  return sources.filter((source) => {
    if (
      state.reviewStatus !== "all" &&
      source.reviewStatus !== state.reviewStatus
    ) {
      return false;
    }
    if (state.sourceType !== "all" && source.sourceType !== state.sourceType) {
      return false;
    }
    if (state.authorType !== "all" && source.authorType !== state.authorType) {
      return false;
    }
    if (state.relationship === "supporting") {
      return relationships.supportingIds.has(source.id);
    }
    if (state.relationship === "counterevidence") {
      return relationships.counterEvidenceIds.has(source.id);
    }
    return true;
  });
}

function reviewRank(status: EvidenceReviewStatus): number {
  return EVIDENCE_REVIEW_SORT_ORDER.indexOf(status);
}

export function sortEvidenceSources(
  sources: EvidenceSource[],
  state: EvidenceInventoryState,
  originalOrder: readonly string[],
): EvidenceSource[] {
  const originalIndex = new Map(
    originalOrder.map((id, index) => [id, index] as const),
  );
  const sorted = [...sources];
  sorted.sort((a, b) => {
    switch (state.sort) {
      case "review": {
        const reviewDiff = reviewRank(a.reviewStatus) - reviewRank(b.reviewStatus);
        if (reviewDiff !== 0) {
          return reviewDiff;
        }
        return a.title.localeCompare(b.title);
      }
      case "published_newest": {
        const dateDiff = b.publishedOn.localeCompare(a.publishedOn);
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return a.title.localeCompare(b.title);
      }
      case "published_oldest": {
        const dateDiff = a.publishedOn.localeCompare(b.publishedOn);
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return a.title.localeCompare(b.title);
      }
      case "source_type": {
        const typeDiff = a.sourceType.localeCompare(b.sourceType);
        if (typeDiff !== 0) {
          return typeDiff;
        }
        return a.title.localeCompare(b.title);
      }
      case "author_type": {
        const typeDiff = a.authorType.localeCompare(b.authorType);
        if (typeDiff !== 0) {
          return typeDiff;
        }
        return a.title.localeCompare(b.title);
      }
      case "organization": {
        const orgDiff = a.organization.localeCompare(b.organization);
        if (orgDiff !== 0) {
          return orgDiff;
        }
        return a.title.localeCompare(b.title);
      }
      case "title":
        return a.title.localeCompare(b.title);
      case "original":
      default: {
        const aIndex = originalIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = originalIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      }
    }
  });
  return sorted;
}

export function applyEvidenceInventory(
  sources: EvidenceSource[],
  state: EvidenceInventoryState,
  claims: Claim[],
): EvidenceSource[] {
  const relationships = buildEvidenceRelationshipIndex(claims);
  const originalOrder = sources.map((source) => source.id);
  return sortEvidenceSources(
    filterEvidenceSources(sources, state, relationships),
    state,
    originalOrder,
  );
}
