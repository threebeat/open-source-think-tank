import { describe, expect, it } from "vitest";

import { listPublicDemoDiscussionRelationships } from "@/features/formal-topics/discussion-relationships";

describe("public-demo discussion relationships", () => {
  it("exposes allowlisted Idea Commons links with informal notices", () => {
    const items = listPublicDemoDiscussionRelationships(
      "cedar-river-drought-surcharge",
    );
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.synthetic).toBe(true);
      expect(item.ideaCommonsHref).toMatch(/^\/idea-commons\//);
      expect(item.informalNotice.length).toBeGreaterThan(0);
      expect(item).not.toHaveProperty("accountId");
    }
  });

  it("marks moderator ordinary proposals without ranking privilege language", () => {
    const items = listPublicDemoDiscussionRelationships(
      "cedar-river-drought-surcharge",
    );
    const moderator = items.find((item) =>
      item.lineageReason?.includes("Moderator-authored"),
    );
    expect(moderator?.relationship).toBe("related");
    expect(moderator?.lineageReason).toMatch(/no ranking advantage/i);
  });
});
