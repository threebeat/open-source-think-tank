import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  organizationMemberships,
  persons,
  profiles,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import {
  SYNTHETIC_AGENDA_OPEN_SLUG,
  SYNTHETIC_AGENDA_OPEN_STATEMENT_ID,
  SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID,
  SYNTHETIC_AGENDA_ACCEPTED_SLUG,
} from "@/db/seeds/v2-agenda";
import {
  SYNTHETIC_ORG_ALPHA_CONFIG_ID,
  SYNTHETIC_ORG_ALPHA_ID,
  SYNTHETIC_ORG_BETA_ID,
} from "@/db/seeds/v2-organizations";
import { playFixtureConsultationClose } from "@/lib/agenda/playback";
import {
  getAgendaTopic,
  listAgenda,
  recordMemberPosition,
} from "@/lib/agenda/service";
import { newEntityId } from "@/lib/auth/tokens";
import { loadPrincipal } from "@/lib/authz/load-principal";
import { evaluateTransition } from "@/lib/governance/machine";
import {
  createGovernanceRecord,
  transitionGovernanceRecord,
} from "@/lib/governance/service";
import { getGovernanceRecord } from "@/lib/governance/repository";
import { requireOrganizationId } from "@/lib/organizations/ids";

const ALPHA = SYNTHETIC_ORG_ALPHA_ID;
const BETA = SYNTHETIC_ORG_BETA_ID;

describe("agenda service", () => {
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
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_synth_agenda_unit";
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
      displayLabel: `ostt-synth agenda ${suffix}`,
    });
    await db.insert(accounts).values({
      id: accountId,
      personId,
      contactChannel: `agenda-${suffix}@ostt.synth.test`,
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

  it("requires organizationId and lists only Public Agenda rows", async () => {
    expect(() => requireOrganizationId("")).toThrow(/ORGANIZATION_ID_REQUIRED/);
    const { principal } = await insertCommunityMember("list");
    const listed = await listAgenda(db, { principal, organizationId: ALPHA });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.hostedPolisEnabled).toBe(false);
    expect(listed.value.topics.some((row) => row.slug === SYNTHETIC_AGENDA_OPEN_SLUG)).toBe(
      true,
    );
    expect(
      listed.value.topics.some((row) => row.slug === SYNTHETIC_AGENDA_ACCEPTED_SLUG),
    ).toBe(true);
    expect(listed.value.topics.every((row) => row.state !== "informal_draft")).toBe(
      true,
    );
    const json = JSON.stringify(listed.value);
    expect(json).not.toMatch(/xid|providerConversationRef|currentProviderEntityId/i);
  });

  it("hides synthetic catalog rows when COMMONHALL_SYNTHETIC_SEED is off", async () => {
    const { principal } = await insertCommunityMember("seedflag");
    process.env.COMMONHALL_SYNTHETIC_SEED = "off";
    const hidden = await listAgenda(db, { principal, organizationId: ALPHA });
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    expect(hidden.value.topics.every((row) => row.synthetic === false)).toBe(true);
    const detail = await getAgendaTopic(db, {
      principal,
      organizationId: ALPHA,
      slugOrPublicId: SYNTHETIC_AGENDA_OPEN_SLUG,
    });
    expect(detail.ok).toBe(false);
    delete process.env.COMMONHALL_SYNTHETIC_SEED;
  });

  it("does not list alpha topics in the beta organization", async () => {
    const { principal } = await insertCommunityMember("beta", BETA);
    const listed = await listAgenda(db, { principal, organizationId: BETA });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.topics).toEqual([]);
    const leaked = await getAgendaTopic(db, {
      principal,
      organizationId: BETA,
      slugOrPublicId: SYNTHETIC_AGENDA_OPEN_SLUG,
    });
    expect(leaked.ok).toBe(false);
  });

  it("records in-house positions and keeps evidence order independent", async () => {
    const { principal } = await insertCommunityMember("position");
    const before = await getAgendaTopic(db, {
      principal,
      organizationId: ALPHA,
      slugOrPublicId: SYNTHETIC_AGENDA_OPEN_SLUG,
    });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.hostedPolisEnabled).toBe(false);
    expect(before.value.canRecordPosition).toBe(true);
    const evidenceOrder = before.value.evidence.map((row) => row.title);

    const recorded = await recordMemberPosition(db, {
      principal,
      organizationId: ALPHA,
      slugOrPublicId: SYNTHETIC_AGENDA_OPEN_SLUG,
      statementPublicId: SYNTHETIC_AGENDA_OPEN_STATEMENT_ID,
      position: "agree",
    });
    expect(recorded.ok).toBe(true);

    const after = await getAgendaTopic(db, {
      principal,
      organizationId: ALPHA,
      slugOrPublicId: SYNTHETIC_AGENDA_OPEN_SLUG,
    });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(
      after.value.statements.find(
        (row) => row.publicId === SYNTHETIC_AGENDA_OPEN_STATEMENT_ID,
      )?.viewerPosition,
    ).toBe("agree");
    expect(after.value.evidence.map((row) => row.title)).toEqual(evidenceOrder);
    expect(JSON.stringify(after.value)).not.toMatch(/https:\/\/pol\.is/);
  });

  it("refuses positions from a beta member on an alpha topic", async () => {
    const { principal } = await insertCommunityMember("cross", BETA);
    const denied = await recordMemberPosition(db, {
      principal,
      organizationId: ALPHA,
      slugOrPublicId: SYNTHETIC_AGENDA_OPEN_SLUG,
      statementPublicId: SYNTHETIC_AGENDA_OPEN_STATEMENT_ID,
      position: "disagree",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe("AGENDA_MEMBERSHIP_REQUIRED");
    }
  });

  it("refuses positions on a closed consultation", async () => {
    const { principal } = await insertCommunityMember("closed");
    const denied = await recordMemberPosition(db, {
      principal,
      organizationId: ALPHA,
      slugOrPublicId: SYNTHETIC_AGENDA_ACCEPTED_SLUG,
      statementPublicId: "stmt-ostt-synth-library-hours",
      position: "agree",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe("AGENDA_CONSULTATION_CLOSED");
    }
  });

  it("plays fixture close only for synthetic qualified topics with trustedSystem", async () => {
    const created = await createGovernanceRecord(db, {
      organizationId: ALPHA,
      publicId: "gov-ostt-synth-playback-open",
      configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
      synthetic: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const untrusted = await transitionGovernanceRecord(db, {
      principal: null,
      organizationId: ALPHA,
      recordId: created.value.recordId,
      action: "close_as_accepted",
      actor: "system_from_published_rule",
      metricsSnapshot: { labeledSynthetic: true },
      synthetic: true,
    });
    expect(untrusted.ok).toBe(false);
    if (!untrusted.ok) {
      expect(untrusted.code).toBe("GOVERNANCE_SYSTEM_ACTOR_UNTRUSTED");
    }

    const informal = await playFixtureConsultationClose(db, {
      organizationId: ALPHA,
      recordId: "govrec_ostt_synth_alpha_informal",
      action: "close_as_accepted",
    });
    expect(informal.ok).toBe(false);

    const alreadyClosed = await playFixtureConsultationClose(db, {
      organizationId: ALPHA,
      recordId: SYNTHETIC_AGENDA_ACCEPTED_RECORD_ID,
      action: "close_as_accepted",
    });
    expect(alreadyClosed.ok).toBe(false);
  });

  it("assigns a new provider entity to successors and still blocks informal→chamber", async () => {
    const first = await createGovernanceRecord(db, {
      organizationId: ALPHA,
      publicId: "gov-ostt-synth-successor-a",
      configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
      synthetic: true,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await createGovernanceRecord(db, {
      organizationId: ALPHA,
      publicId: "gov-ostt-synth-successor-b",
      configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
      predecessorRecordId: first.value.recordId,
      copyProviderEntityAsIdentity: true,
      currentProviderEntityId: first.value.currentProviderEntityId,
      synthetic: true,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("GOVERNANCE_SUCCESSOR_REUSES_PROVIDER_ENTITY");
    }
    const successor = await createGovernanceRecord(db, {
      organizationId: ALPHA,
      publicId: "gov-ostt-synth-successor-c",
      configVersionId: SYNTHETIC_ORG_ALPHA_CONFIG_ID,
      predecessorRecordId: first.value.recordId,
      synthetic: true,
    });
    expect(successor.ok).toBe(true);
    if (!successor.ok) return;
    expect(successor.value.currentProviderEntityId).not.toBe(
      first.value.currentProviderEntityId,
    );
    const firstRow = await getGovernanceRecord(db, ALPHA, first.value.recordId);
    const secondRow = await getGovernanceRecord(
      db,
      ALPHA,
      successor.value.recordId,
    );
    expect(firstRow?.currentProviderEntityId).not.toBe(
      secondRow?.currentProviderEntityId,
    );

    const blocked = evaluateTransition({
      from: "informal_draft",
      action: "queue_for_chamber",
      actor: "system_from_published_rule",
    });
    expect(blocked.ok).toBe(false);
    const onlyAccepted = evaluateTransition({
      from: "community_accepted",
      action: "queue_for_chamber",
      actor: "system_from_published_rule",
    });
    expect(onlyAccepted.ok).toBe(true);
    const disputed = evaluateTransition({
      from: "community_disputed",
      action: "queue_for_chamber",
      actor: "system_from_published_rule",
    });
    expect(disputed.ok).toBe(false);
  });

  it("does not import playback from the member positions HTTP handler", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/agenda/positions/route.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/playback|trustedSystem:\s*true/);
    expect(source).toMatch(/Members cannot invoke the system actor/);
  });
});
