import { describe, expect, it } from "vitest";

import {
  assertOrganizationPublicAllowlist,
  projectOrganizationPublic,
} from "@/lib/organizations/public-projection";

describe("organization public projection", () => {
  it("allowlists public fields and omits account/provider/location/ideology", () => {
    const projection = projectOrganizationPublic({
      publicId: "org-ostt-synth-alpha",
      slug: "ostt-synth-alpha",
      displayName: "Synthetic Alpha Hall",
      serviceStatus: "seeded_synthetic",
      regionCodes: ["US-TN"],
    });
    expect(projection).toEqual({
      publicId: "org-ostt-synth-alpha",
      slug: "ostt-synth-alpha",
      displayName: "Synthetic Alpha Hall",
      serviceStatus: "seeded_synthetic",
      regionCodes: ["US-TN"],
    });
    expect(JSON.stringify(projection)).not.toMatch(
      /accountId|xid|provider|latitude|ideology|staffNotes/i,
    );
    expect(() =>
      assertOrganizationPublicAllowlist(projection as unknown as Record<string, unknown>),
    ).not.toThrow();
    expect(() =>
      assertOrganizationPublicAllowlist({
        ...projection,
        accountId: "account-ostt-synth-hidden",
      }),
    ).toThrow(/FORBIDDEN_KEY/);
  });
});
