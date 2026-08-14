import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import {
  SYNTHETIC_ORG_ALPHA_CONFIG_ID,
  SYNTHETIC_ORG_ALPHA_ID,
} from "@/db/seeds/v2-organizations";
import { loadPrincipal } from "@/lib/authz/load-principal";
import {
  createGovernanceRecord,
  transitionGovernanceRecord,
} from "@/lib/governance/service";

describe("governance service kernel", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previous: Record<string, string | undefined>;

  beforeAll(async () => {
    previous = {
      APP_MODE: process.env.APP_MODE,
      DATABASE_URL: process.env.DATABASE_URL,
      COMMONHALL_V2_KERNEL: process.env.COMMONHALL_V2_KERNEL,
    };
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_synth_gov_unit";
    process.env.COMMONHALL_V2_KERNEL = "on";
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("refuses successor reuse of legacy topic identity", async () => {
    const created = await createGovernanceRecord(db, {
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      publicId: "gov-ostt-synth-successor",
      configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
      predecessorRecordId: "govrec_ostt_synth_alpha_informal",
      legacyTopicId: "topic-does-not-need-to-exist",
      copyLegacyTopicIdAsIdentity: true,
      synthetic: true,
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.code).toBe("GOVERNANCE_SUCCESSOR_REUSES_LEGACY_IDENTITY");
    }
  });

  it("refuses system_from_published_rule without a trusted in-process caller", async () => {
    const admin = await loadPrincipal(db, "account-ostt-synth-staff-admin");
    const impersonated = await transitionGovernanceRecord(db, {
      principal: admin,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      recordId: "govrec_ostt_synth_alpha_informal",
      action: "queue_for_chamber",
      actor: "system_from_published_rule",
      synthetic: true,
    });
    expect(impersonated.ok).toBe(false);
    if (!impersonated.ok) {
      expect(impersonated.code).toBe("GOVERNANCE_SYSTEM_ACTOR_UNTRUSTED");
    }
  });

  it("refuses kernel writes when the kill switch is off", async () => {
    process.env.COMMONHALL_V2_KERNEL = "off";
    const admin = await loadPrincipal(db, "account-ostt-synth-staff-admin");
    await expect(
      transitionGovernanceRecord(db, {
        principal: admin,
        organizationId: SYNTHETIC_ORG_ALPHA_ID,
        recordId: "govrec_ostt_synth_alpha_informal",
        action: "submit_for_formal_review",
        actor: "community_member",
        synthetic: true,
      }),
    ).rejects.toThrow(/V2_KERNEL_DISABLED/);
    process.env.COMMONHALL_V2_KERNEL = "on";
  });
});
