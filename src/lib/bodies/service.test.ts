import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  organizationMemberships,
  persons,
  profiles,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { listAgenda } from "@/lib/agenda/service";
import {
  SYNTHETIC_AGENDA_ACCEPTED_SLUG,
} from "@/db/seeds/v2-agenda";
import {
  SYNTHETIC_CHAMBER_MEMBER_A_ACCOUNT_ID,
  SYNTHETIC_CHAMBER_MEMBER_A_APPOINTMENT_ID,
  SYNTHETIC_JOURNEY_SLUG,
  SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
} from "@/db/seeds/v2-chamber-council";
import {
  SYNTHETIC_ORG_ALPHA_CONFIG_ID,
  SYNTHETIC_ORG_ALPHA_ID,
  SYNTHETIC_ORG_BETA_ID,
} from "@/db/seeds/v2-organizations";
import { newEntityId } from "@/lib/auth/tokens";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { insertChamberSession } from "@/lib/bodies/repository";
import {
  getChamberTopic,
  getRecordsTopic,
  listChamber,
  listCouncil,
  listRecords,
  publishChamberVerdict,
  recordCouncilIntake,
} from "@/lib/bodies/service";
import { memberPublicIdForAppointment } from "@/lib/bodies/types";
import {
  isPublicAgendaState,
  type TopicGovernanceState,
} from "@/lib/governance/contract";
import {
  getGovernanceRecordBySlugOrPublicId,
  updateGovernanceRecordState,
} from "@/lib/governance/repository";
import { createGovernanceRecord } from "@/lib/governance/service";
import { grantOrganizationAppointment } from "@/lib/organizations/appointments-service";

const ALPHA = SYNTHETIC_ORG_ALPHA_ID;
const BETA = SYNTHETIC_ORG_BETA_ID;

describe("chamber and council services", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previous: Record<string, string | undefined>;

  beforeAll(async () => {
    previous = {
      APP_MODE: process.env.APP_MODE,
      DATABASE_URL: process.env.DATABASE_URL,
      COMMONHALL_V2_KERNEL: process.env.COMMONHALL_V2_KERNEL,
      COMMONHALL_SYNTHETIC_SEED: process.env.COMMONHALL_SYNTHETIC_SEED,
    };
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_synth_bodies_unit";
    process.env.COMMONHALL_V2_KERNEL = "on";
    delete process.env.COMMONHALL_SYNTHETIC_SEED;
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

  async function insertCommunityMember(suffix: string, organizationId = ALPHA) {
    const personId = newEntityId("person");
    const accountId = newEntityId("account");
    await db.insert(persons).values({
      id: personId,
      synthetic: true,
      displayLabel: `ostt-synth body ${suffix}`,
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: `body-${suffix}@ostt.synth.test`,
      lifecycleState: "active",
      synthetic: true,
      contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
      activatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await db.insert(profiles).values({
      accountId,
      preferredDisplayName: `ostt-synth ${suffix}`,
    });
    await db.insert(organizationMemberships).values({
      id: newEntityId("orgmem"),
      organizationId,
      accountId,
      status: "active",
      isPrimary: true,
      assignedAt: new Date("2026-08-02T00:00:00.000Z"),
      synthetic: true,
    });
    const principal = await loadPrincipal(db, accountId);
    if (!principal) {
      throw new Error("failed to load test principal");
    }
    return { accountId, principal };
  }

  it("seeds a complete sidewalk journey and keeps library hours on the Public Agenda", async () => {
    const library = await getGovernanceRecordBySlugOrPublicId(
      db,
      ALPHA,
      SYNTHETIC_AGENDA_ACCEPTED_SLUG,
    );
    expect(library?.state).toBe("chamber_queued");
    expect(isPublicAgendaState(library?.state ?? "")).toBe(true);

    const journey = await getGovernanceRecordBySlugOrPublicId(
      db,
      ALPHA,
      SYNTHETIC_JOURNEY_SLUG,
    );
    expect(journey?.state).toBe("recommendations_published");
    expect(isPublicAgendaState(journey?.state ?? "")).toBe(false);

    const { principal } = await insertCommunityMember("observer");
    const chamber = await listChamber(db, { principal, organizationId: ALPHA });
    expect(chamber.ok).toBe(true);
    if (!chamber.ok) return;
    expect(chamber.value.topics.some((row) => row.slug === SYNTHETIC_AGENDA_ACCEPTED_SLUG)).toBe(
      true,
    );
    expect(chamber.value.topics.some((row) => row.slug === SYNTHETIC_JOURNEY_SLUG)).toBe(
      true,
    );
    expect(chamber.value.hostedPolisEnabled).toBe(false);

    const council = await listCouncil(db, { principal, organizationId: ALPHA });
    expect(council.ok).toBe(true);
    if (!council.ok) return;
    expect(council.value.topics.some((row) => row.slug === SYNTHETIC_JOURNEY_SLUG)).toBe(
      true,
    );

    const agenda = await listAgenda(db, { principal, organizationId: ALPHA });
    expect(agenda.ok).toBe(true);
    if (!agenda.ok) return;
    expect(
      agenda.value.topics.some((row) => row.slug === SYNTHETIC_AGENDA_ACCEPTED_SLUG),
    ).toBe(true);
    expect(agenda.value.topics.some((row) => row.slug === SYNTHETIC_JOURNEY_SLUG)).toBe(
      false,
    );

    const records = await listRecords(db, { principal, organizationId: ALPHA });
    expect(records.ok).toBe(true);
    if (!records.ok) return;
    expect(records.value.topics.some((row) => row.slug === SYNTHETIC_JOURNEY_SLUG)).toBe(
      true,
    );

    const detail = await getRecordsTopic(db, {
      principal,
      organizationId: ALPHA,
      slugOrPublicId: SYNTHETIC_JOURNEY_SLUG,
    });
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.chamberRollCall.map((row) => row.position).sort()).toEqual(
      ["no", "recused", "yes"].sort(),
    );
    expect(detail.value.councilRollCall.map((row) => row.position).sort()).toEqual(
      ["abstain", "absent", "yes"].sort(),
    );
    expect(JSON.stringify(detail.value)).not.toMatch(/accountId|xid|pol\.is/i);
  });

  it("does not list alpha Chamber topics in the beta organization", async () => {
    const { principal } = await insertCommunityMember("beta", BETA);
    const listed = await listChamber(db, { principal, organizationId: BETA });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.topics).toEqual([]);
    const leaked = await getChamberTopic(db, {
      principal,
      organizationId: BETA,
      slugOrPublicId: SYNTHETIC_JOURNEY_SLUG,
    });
    expect(leaked.ok).toBe(false);
  });

  it("denies a community member without a Chamber seat from publishing a verdict", async () => {
    const { principal } = await insertCommunityMember("noseat");
    const denied = await publishChamberVerdict(db, {
      principal,
      organizationId: ALPHA,
      slugOrPublicId: SYNTHETIC_AGENDA_ACCEPTED_SLUG,
      outcome: "accepted",
      rationale: "community member attempting a body vote",
      rollCall: [
        {
          memberPublicId: memberPublicIdForAppointment(
            SYNTHETIC_CHAMBER_MEMBER_A_APPOINTMENT_ID,
          ),
          position: "yes",
        },
      ],
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe("AUTHZ_DENIED");
    }
  });

  it("denies a community member from self-appointing", async () => {
    const { accountId, principal } = await insertCommunityMember("selfappt");
    const granted = await grantOrganizationAppointment(db, {
      principal,
      organizationId: ALPHA,
      subjectAccountId: accountId,
      appointmentKind: "chamber_member",
      termStartsAt: new Date("2026-08-01T00:00:00.000Z"),
      synthetic: true,
    });
    expect(granted.ok).toBe(false);
    if (!granted.ok) {
      expect(granted.code).toBe("AUTHZ_DENIED");
    }

    const orgAdmin = await loadPrincipal(db, SYNTHETIC_ORG_ADMIN_ACCOUNT_ID);
    if (!orgAdmin) {
      throw new Error("missing synthetic org admin");
    }
    const selfGrant = await grantOrganizationAppointment(db, {
      principal: orgAdmin,
      organizationId: ALPHA,
      subjectAccountId: SYNTHETIC_ORG_ADMIN_ACCOUNT_ID,
      appointmentKind: "chamber_member",
      termStartsAt: new Date("2026-08-01T00:00:00.000Z"),
      synthetic: true,
    });
    expect(selfGrant.ok).toBe(false);
    if (!selfGrant.ok) {
      expect(selfGrant.code).toBe("APPOINTMENT_SELF_GRANT_FORBIDDEN");
    }
  });

  it("denies Council reason-rule bypass and wrong-seat intake", async () => {
    const acceptedSlug = "ostt-synth-reason-accepted";
    const disputedSlug = "ostt-synth-reason-disputed";
    await plantBodyTopic(acceptedSlug, "chamber_accepted");
    await plantBodyTopic(disputedSlug, "chamber_disputed");

    const { principal: community } = await insertCommunityMember("noreason");
    const communityDenied = await recordCouncilIntake(db, {
      principal: community,
      organizationId: ALPHA,
      slugOrPublicId: acceptedSlug,
      action: "decline_council_intake",
    });
    expect(communityDenied.ok).toBe(false);
    if (!communityDenied.ok) {
      expect(communityDenied.code).toBe("AUTHZ_DENIED");
    }

    const chamberMember = await loadPrincipal(
      db,
      SYNTHETIC_CHAMBER_MEMBER_A_ACCOUNT_ID,
    );
    if (!chamberMember) {
      throw new Error("missing synthetic chamber member");
    }
    const wrongSeat = await recordCouncilIntake(db, {
      principal: chamberMember,
      organizationId: ALPHA,
      slugOrPublicId: acceptedSlug,
      action: "decline_council_intake",
      reason: "chamber member attempting council intake",
    });
    expect(wrongSeat.ok).toBe(false);
    if (!wrongSeat.ok) {
      expect(wrongSeat.code).toBe("AUTHZ_DENIED");
    }

    const councilMember = await loadPrincipal(db, "account-ostt-synth-council-a");
    if (!councilMember) {
      throw new Error("missing synthetic council member");
    }
    const declineWithoutReason = await recordCouncilIntake(db, {
      principal: councilMember,
      organizationId: ALPHA,
      slugOrPublicId: acceptedSlug,
      action: "decline_council_intake",
    });
    expect(declineWithoutReason.ok).toBe(false);
    if (!declineWithoutReason.ok) {
      expect(declineWithoutReason.code).toBe("GOVERNANCE_REASON_REQUIRED");
    }

    const acceptDisputedWithoutReason = await recordCouncilIntake(db, {
      principal: councilMember,
      organizationId: ALPHA,
      slugOrPublicId: disputedSlug,
      action: "accept_disputed_to_council_agenda",
    });
    expect(acceptDisputedWithoutReason.ok).toBe(false);
    if (!acceptDisputedWithoutReason.ok) {
      expect(acceptDisputedWithoutReason.code).toBe("GOVERNANCE_REASON_REQUIRED");
    }

    const declined = await recordCouncilIntake(db, {
      principal: councilMember,
      organizationId: ALPHA,
      slugOrPublicId: acceptedSlug,
      action: "decline_council_intake",
      reason: "Synthetic override: Council declines this Chamber-accepted fixture.",
    });
    expect(declined.ok).toBe(true);
    const declinedRow = await getGovernanceRecordBySlugOrPublicId(
      db,
      ALPHA,
      acceptedSlug,
    );
    expect(declinedRow?.state).toBe("council_declined");
    expect(isPublicAgendaState(declinedRow?.state ?? "")).toBe(true);
  });

  it("does not infer absent from a missing Chamber roll-call seat", async () => {
    const slug = "ostt-synth-incomplete-roll";
    await plantBodyTopic(slug, "chamber_deliberating");
    const record = await getGovernanceRecordBySlugOrPublicId(db, ALPHA, slug);
    if (!record) {
      throw new Error("missing planted deliberating topic");
    }
    await insertChamberSession(db, {
      id: `chsess_${record.id}`,
      organizationId: ALPHA,
      publicId: `chsess-pub-${record.id}`,
      recordId: record.id,
      status: "in_session",
      timezone: "America/Chicago",
      scheduledOpensAt: new Date("2026-08-14T17:00:00.000Z"),
      scheduledClosesAt: new Date("2026-08-14T19:00:00.000Z"),
      synthetic: true,
    });
    const chamberMember = await loadPrincipal(
      db,
      SYNTHETIC_CHAMBER_MEMBER_A_ACCOUNT_ID,
    );
    if (!chamberMember) {
      throw new Error("missing synthetic chamber member");
    }
    const incomplete = await publishChamberVerdict(db, {
      principal: chamberMember,
      organizationId: ALPHA,
      slugOrPublicId: slug,
      outcome: "accepted",
      rationale: "Incomplete roll call must fail closed.",
      rollCall: [
        {
          memberPublicId: memberPublicIdForAppointment(
            SYNTHETIC_CHAMBER_MEMBER_A_APPOINTMENT_ID,
          ),
          position: "yes",
        },
      ],
    });
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) {
      expect(incomplete.code).toBe("ROLL_CALL_INCOMPLETE");
    }
  });

  it("does not import playback from body HTTP handlers", () => {
    const httpHelper = readFileSync(
      path.join(process.cwd(), "src/lib/bodies/http.ts"),
      "utf8",
    );
    expect(httpHelper).toMatch(/Members cannot invoke the system actor/);
    expect(httpHelper).toMatch(/GOVERNANCE_SYSTEM_ACTOR_UNTRUSTED/);
    expect(httpHelper).not.toMatch(/from "@\/lib\/bodies\/playback"/);

    for (const relative of [
      "src/app/api/chamber/verdict/route.ts",
      "src/app/api/council/intake/route.ts",
      "src/app/api/council/recommendations/route.ts",
      "src/app/api/bodies/deliberation/route.ts",
    ]) {
      const source = readFileSync(path.join(process.cwd(), relative), "utf8");
      expect(source).not.toMatch(/from "@\/lib\/bodies\/playback"/);
      expect(source).not.toMatch(/trustedSystem:\s*true/);
      expect(source).toMatch(/rejectTrustedSystem/);
    }
  });

  async function plantBodyTopic(
    slug: string,
    state: TopicGovernanceState,
  ): Promise<void> {
    const created = await createGovernanceRecord(db, {
      organizationId: ALPHA,
      publicId: `gov-${slug}`,
      configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
      slug,
      title: `Synthetic planted topic ${slug}`,
      question: "Synthetic planted Chamber/Council fixture.",
      synthetic: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.code);
    }
    await updateGovernanceRecordState(db, {
      organizationId: ALPHA,
      recordId: created.value.recordId,
      state,
    });
  }
});
