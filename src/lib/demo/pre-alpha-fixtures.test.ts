import { describe, expect, it } from "vitest";

import {
  DEMO_AGENDA_TOPICS,
  DEMO_CHAMBER_ROLL,
  DEMO_COMMONS,
  DEMO_NONPROFIT_CONTACT,
} from "@/lib/demo/pre-alpha-fixtures";

describe("pre-alpha demo fixtures", () => {
  it("keeps informal posts out of Formal Commons", () => {
    const formalIds = DEMO_COMMONS.formal.flatMap((group) =>
      group.discussions.map((row) => row.publicId),
    );
    const informalIds = DEMO_COMMONS.informal.flatMap((group) =>
      group.discussions.map((row) => row.publicId),
    );
    expect(formalIds).toContain("demo-sidewalk-thread");
    expect(informalIds).toContain("demo-lighting-thread");
    expect(formalIds).not.toContain("demo-lighting-thread");
  });

  it("labels agenda and roll-call fixtures as synthetic and complete", () => {
    expect(DEMO_AGENDA_TOPICS.every((topic) => topic.synthetic)).toBe(true);
    expect(new Set(DEMO_CHAMBER_ROLL.map((row) => row.position)).size).toBeGreaterThan(
      1,
    );
    expect(DEMO_NONPROFIT_CONTACT.email).toMatch(/@commonhall\.example$/);
  });
});
