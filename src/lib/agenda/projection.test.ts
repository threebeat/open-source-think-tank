import { describe, expect, it } from "vitest";

import {
  assertPublicAgendaDto,
  syntheticEvidenceToDto,
  toListItemDto,
} from "@/lib/agenda/projection";
import type { GovernanceRecordRow } from "@/lib/governance/repository";

function record(
  overrides: Partial<GovernanceRecordRow> = {},
): GovernanceRecordRow {
  return {
    id: "govrec_test",
    organizationId: "org_a",
    publicId: "gov-test",
    state: "qualified_consultation",
    configVersionId: "cfg",
    authorAccountId: null,
    retentionDeadlineAt: null,
    legacyTopicId: null,
    predecessorRecordId: null,
    slug: "test-topic",
    title: "Synthetic test topic",
    question: "A question?",
    overview: "Overview",
    syntheticEvidence: {
      labeledSynthetic: true,
      items: [
        {
          title: "Zebra source",
          summary: "Later alphabetically",
          qualityStatus: "accepted",
          limitations: "Synthetic",
        },
        {
          title: "Alpha source",
          summary: "Should not outrank accepted",
          qualityStatus: "limited",
          limitations: "Synthetic",
        },
        {
          title: "Beta source",
          summary: "Same quality as zebra sorts by title",
          qualityStatus: "accepted",
          limitations: "Synthetic",
        },
      ],
    },
    syntheticStatements: [{ publicId: "stmt-1", text: "A statement" }],
    fixtureConversationId: "pinconv_secret",
    currentProviderEntityId: "pvent_secret",
    synthetic: true,
    ...overrides,
  };
}

describe("agenda public projection", () => {
  it("omits provider mappings, people, and pol.is URLs", () => {
    const item = toListItemDto(record());
    expect(item).toMatchObject({
      publicId: "gov-test",
      slug: "test-topic",
      synthetic: true,
    });
    expect(JSON.stringify(item)).not.toMatch(/pvent_secret|pinconv_secret|xid/i);
    assertPublicAgendaDto(item);
  });

  it("orders evidence by quality then title, never by popularity", () => {
    const ordered = syntheticEvidenceToDto(record().syntheticEvidence);
    expect(ordered.map((row) => row.title)).toEqual([
      "Beta source",
      "Zebra source",
      "Alpha source",
    ]);
    expect(ordered.every((row) => row.labeledSynthetic)).toBe(true);
  });

  it("rejects forbidden keys in public JSON", () => {
    expect(() =>
      assertPublicAgendaDto({ publicId: "x", xid: "abc" }),
    ).toThrow(/AGENDA_PUBLIC_DTO_FORBIDDEN_KEY:xid/);
    expect(() =>
      assertPublicAgendaDto({ script: "https://pol.is/embed.js" }),
    ).toThrow(/AGENDA_PUBLIC_DTO_POLIS_URL/);
  });
});
