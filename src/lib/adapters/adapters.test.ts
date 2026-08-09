import { describe, expect, it } from "vitest";

import { createPublicDemoAdapters } from "@/lib/adapters";

describe("public-demo adapters", () => {
  it("refuses persistence and invite acceptance", async () => {
    const adapters = createPublicDemoAdapters();
    expect(adapters.mode).toBe("public-demo");

    const health = await adapters.persistence.healthCheck();
    expect(health.ok).toBe(false);
    if (!health.ok) {
      expect(health.code).toBe("PUBLIC_DEMO_NO_DB");
    }

    const invite = await adapters.auth.acceptInvite({
      inviteToken: "synthetic",
      contactChannel: "nobody@example.test",
    });
    expect(invite.ok).toBe(false);
    if (!invite.ok) {
      expect(invite.code).toBe("PUBLIC_DEMO_NO_AUTH");
    }

    const consult = await adapters.consultationParticipation.issuePseudonym(
      "account",
      "conversation",
    );
    expect(consult.ok).toBe(false);
  });
});
