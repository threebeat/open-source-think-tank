import { describe, expect, it } from "vitest";

import {
  FORMAL_COMMONS_CATEGORIES,
  INFORMAL_COMMONS_CATEGORIES,
  MEMBER_CREATE_CATEGORIES,
  UNREVIEWED_CONTENT_DISCLAIMER,
  isFormalCategory,
  isMemberCreateCategory,
} from "@/lib/commons/categories";

describe("commons information architecture", () => {
  it("keeps the exact unreviewed-content disclaimer", () => {
    expect(UNREVIEWED_CONTENT_DISCLAIMER).toBe(
      "Informal conversations may not have been reviewed by a moderator and have not qualified for community deliberation. Their presence does not mean the organization endorses their claims, evidence, or conduct. Report rule-breaking content; challenge ideas without attacking people.",
    );
  });

  it("lists formal categories before informal ones", () => {
    expect([...FORMAL_COMMONS_CATEGORIES]).toEqual([
      "moderator_communications",
      "council_communications",
      "qualified_topic_discussions",
      "qualified_approach_discussions",
      "community_actions",
    ]);
    expect([...INFORMAL_COMMONS_CATEGORIES]).toEqual([
      "topic_proposals",
      "approach_proposals",
      "general_discussion",
      "disqualified_topics",
    ]);
    expect(FORMAL_COMMONS_CATEGORIES.every(isFormalCategory)).toBe(true);
    expect(INFORMAL_COMMONS_CATEGORIES.some(isFormalCategory)).toBe(false);
  });

  it("lets members create only informal non-disqualified categories", () => {
    expect([...MEMBER_CREATE_CATEGORIES]).toEqual([
      "topic_proposals",
      "approach_proposals",
      "general_discussion",
    ]);
    expect(isMemberCreateCategory("general_discussion")).toBe(true);
    expect(isMemberCreateCategory("disqualified_topics")).toBe(false);
    expect(isMemberCreateCategory("moderator_communications")).toBe(false);
  });
});
