import {
  organizationConfigVersions,
  organizationServiceAreas,
  organizations,
  topicGovernanceRecords,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import {
  CONSTITUTIONAL_FLOOR_VERSION,
  SYNTHETIC_CONSTITUTIONAL_CONFIG,
} from "@/lib/organizations/constitutional-floor";

export const SYNTHETIC_ORG_ALPHA_ID = "org_ostt_synth_alpha_internal";
export const SYNTHETIC_ORG_BETA_ID = "org_ostt_synth_beta_internal";
export const SYNTHETIC_ORG_ALPHA_PUBLIC_ID = "org-ostt-synth-alpha";
export const SYNTHETIC_ORG_BETA_PUBLIC_ID = "org-ostt-synth-beta";
export const SYNTHETIC_ORG_ALPHA_CONFIG_ID = "orgcfg_ostt_synth_alpha_v1";
export const SYNTHETIC_ORG_BETA_CONFIG_ID = "orgcfg_ostt_synth_beta_v1";
export const SYNTHETIC_ORG_ALPHA_GOVERNANCE_ID =
  "govrec_ostt_synth_alpha_informal";

/**
 * Two synthetic organizations for isolation tests. Does not convert alpha
 * accounts or legacy council_appointments into v2 authority.
 */
export async function seedV2Organizations(db: FoundationDb): Promise<void> {
  await db
    .insert(organizations)
    .values([
      {
        id: SYNTHETIC_ORG_ALPHA_ID,
        publicId: SYNTHETIC_ORG_ALPHA_PUBLIC_ID,
        slug: "ostt-synth-alpha",
        displayName: "Synthetic Alpha Hall",
        serviceStatus: "seeded_synthetic",
        synthetic: true,
      },
      {
        id: SYNTHETIC_ORG_BETA_ID,
        publicId: SYNTHETIC_ORG_BETA_PUBLIC_ID,
        slug: "ostt-synth-beta",
        displayName: "Synthetic Beta Hall",
        serviceStatus: "seeded_synthetic",
        synthetic: true,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(organizationServiceAreas)
    .values([
      {
        id: "orgarea_ostt_synth_alpha_us_tn",
        organizationId: SYNTHETIC_ORG_ALPHA_ID,
        regionCode: "US-TN",
        synthetic: true,
      },
      {
        id: "orgarea_ostt_synth_beta_us_ky",
        organizationId: SYNTHETIC_ORG_BETA_ID,
        regionCode: "US-KY",
        synthetic: true,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(organizationConfigVersions)
    .values([
      {
        id: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
        organizationId: SYNTHETIC_ORG_ALPHA_ID,
        version: 1,
        constitutionalFloorVersion: CONSTITUTIONAL_FLOOR_VERSION,
        config: SYNTHETIC_CONSTITUTIONAL_CONFIG,
        status: "published",
        publishedAt: new Date("2026-08-01T00:00:00.000Z"),
        publishedByAccountId: "account-ostt-synth-staff-admin",
        synthetic: true,
      },
      {
        id: SYNTHETIC_ORG_BETA_CONFIG_ID,
        organizationId: SYNTHETIC_ORG_BETA_ID,
        version: 1,
        constitutionalFloorVersion: CONSTITUTIONAL_FLOOR_VERSION,
        config: SYNTHETIC_CONSTITUTIONAL_CONFIG,
        status: "published",
        publishedAt: new Date("2026-08-01T00:00:00.000Z"),
        publishedByAccountId: "account-ostt-synth-staff-admin",
        synthetic: true,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(topicGovernanceRecords)
    .values({
      id: SYNTHETIC_ORG_ALPHA_GOVERNANCE_ID,
      organizationId: SYNTHETIC_ORG_ALPHA_ID,
      publicId: "gov-ostt-synth-alpha-informal",
      state: "informal_draft",
      configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
      synthetic: true,
    })
    .onConflictDoNothing();
}
