import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { auditEvents, publicInputConversations } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import { createTopic } from "@/lib/topics/authoring";
import { getConversationById } from "@/lib/public-input/lifecycle/repository";
import {
  attachProviderMapping,
  createConversation,
  getPublicConsultationView,
  getStaffConsultationSummary,
  recoverConversation,
  removeProviderMapping,
  rotateProviderMapping,
  setProviderAvailability,
  transitionConversation,
} from "@/lib/public-input/lifecycle/service";
import { assertNoProviderRefLeak } from "@/lib/public-input/lifecycle/types";

const ADMIN = "account-ostt-synth-staff-admin";
const MODERATOR = "account-ostt-synth-staff-moderator";
const PARTICIPANT = "account-ostt-synth-ada";

describe("Public Input conversation lifecycle service (4.3)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  let previousMode: string | undefined;
  let previousDbUrl: string | undefined;
  let topicCounter = 0;

  beforeAll(async () => {
    previousMode = process.env.APP_MODE;
    previousDbUrl = process.env.DATABASE_URL;
    process.env.APP_MODE = "gated";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgres://ostt:ostt@127.0.0.1:54329/ostt_pglite_public_input_lifecycle";

    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
  }, 120_000);

  afterAll(async () => {
    await client.close();
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
    if (previousDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDbUrl;
  });

  async function freshTopicId(): Promise<string> {
    topicCounter += 1;
    const created = await createTopic(db, {
      actorAccountId: ADMIN,
      slug: `pinconv-fixture-topic-${topicCounter}`,
      title: `Public Input fixture topic ${topicCounter}`,
      question: "What should change?",
      background: "Background for a Public Input lifecycle fixture topic.",
      scope: "Alpha test scope.",
      jurisdictionLevel: "statewide",
      countyFips: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("failed to create fixture topic");
    return created.value.id;
  }

  it("creates a draft conversation and audits consultations.created", async () => {
    const topicId = await freshTopicId();
    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Community input on billing changes",
      publicPrompt: "What tradeoffs matter most to you?",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.workflowState).toBe("draft");
    expect(created.value.providerKind).toBe("none");
    expect(created.value.providerConversationRef).toBeNull();
    expect(created.value.designation).toBe("current");
    expect(created.value.version).toBe(1);

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectId, created.value.id),
          eq(auditEvents.action, "consultations.created"),
        ),
      );
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit)).not.toContain("providerConversationRef");
  });

  it("denies create/transition/availability/mapping capabilities for moderators", async () => {
    const topicId = await freshTopicId();
    const deniedCreate = await createConversation(db, {
      actorAccountId: MODERATOR,
      topicId,
      publicTitle: "Should never be created",
      publicPrompt: "Should never be created",
    });
    expect(deniedCreate.ok).toBe(false);
    if (!deniedCreate.ok) expect(deniedCreate.code).toBe("AUTHZ_DENIED");

    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Moderator denial fixture",
      publicPrompt: "Moderator denial fixture prompt",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deniedTransition = await transitionConversation(db, {
      actorAccountId: MODERATOR,
      conversationId: created.value.id,
      action: "mark_ready",
      expectedWorkflowState: "draft",
      expectedVersion: created.value.version,
    });
    expect(deniedTransition.ok).toBe(false);
    if (!deniedTransition.ok) expect(deniedTransition.code).toBe("AUTHZ_DENIED");

    const deniedAvailability = await setProviderAvailability(db, {
      actorAccountId: MODERATOR,
      conversationId: created.value.id,
      expectedVersion: created.value.version,
      availability: "available",
    });
    expect(deniedAvailability.ok).toBe(false);
    if (!deniedAvailability.ok) {
      expect(deniedAvailability.code).toBe("AUTHZ_DENIED");
    }

    const deniedMapping = await attachProviderMapping(db, {
      actorAccountId: MODERATOR,
      conversationId: created.value.id,
      expectedVersion: created.value.version,
    });
    expect(deniedMapping.ok).toBe(false);
    if (!deniedMapping.ok) expect(deniedMapping.code).toBe("AUTHZ_DENIED");

    // account-ostt-synth-ada is seeded pending_onboarding (not active), so this
    // denial may surface either the active-lifecycle gate or the role gate —
    // both are legitimate fail-closed outcomes; only an AUTHZ_ code is asserted.
    const deniedParticipant = await createConversation(db, {
      actorAccountId: PARTICIPANT,
      topicId,
      publicTitle: "Participants cannot create either",
      publicPrompt: "Participants cannot create either",
    });
    expect(deniedParticipant.ok).toBe(false);
    if (!deniedParticipant.ok) {
      expect(deniedParticipant.code).toMatch(/^AUTHZ_/);
    }
  });

  it("enforces at most one current conversation per topic", async () => {
    const topicId = await freshTopicId();
    const first = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "First conversation",
      publicPrompt: "First conversation prompt",
    });
    expect(first.ok).toBe(true);

    const second = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Second conversation should be refused",
      publicPrompt: "Second conversation should be refused",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("TOPIC_ALREADY_HAS_CURRENT_CONVERSATION");
    }
  });

  it("enforces the one-current-per-topic constraint under a race (DB unique index is authoritative)", async () => {
    const topicId = await freshTopicId();
    const [a, b] = await Promise.all([
      createConversation(db, {
        actorAccountId: ADMIN,
        topicId,
        publicTitle: "Race A",
        publicPrompt: "Race A prompt",
      }),
      createConversation(db, {
        actorAccountId: ADMIN,
        topicId,
        publicTitle: "Race B",
        publicPrompt: "Race B prompt",
      }),
    ]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect([a, b].some((r) => !r.ok)).toBe(true);
  });

  it("follows the forward transition pipeline and rejects unlisted paths", async () => {
    const topicId = await freshTopicId();
    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Pipeline fixture",
      publicPrompt: "Pipeline fixture prompt",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;

    const skipToOpen = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: id,
      action: "open",
      expectedWorkflowState: "draft",
      expectedVersion: created.value.version,
    });
    expect(skipToOpen.ok).toBe(false);
    if (!skipToOpen.ok) {
      expect(skipToOpen.code).toBe("CONSULTATION_TRANSITION_DENIED");
    }

    const ready = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: id,
      action: "mark_ready",
      expectedWorkflowState: "draft",
      expectedVersion: created.value.version,
    });
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    expect(ready.value.workflowState).toBe("ready");
    expect(ready.value.version).toBe(created.value.version + 1);

    const opened = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: id,
      action: "open",
      expectedWorkflowState: "ready",
      expectedVersion: ready.value.version,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const closeWithoutReason = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: id,
      action: "close_commenting",
      expectedWorkflowState: "open",
      expectedVersion: opened.value.version,
    });
    expect(closeWithoutReason.ok).toBe(true);
    if (!closeWithoutReason.ok) return;

    const closeVotingNoReason = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: id,
      action: "close_voting",
      expectedWorkflowState: "commenting_closed",
      expectedVersion: closeWithoutReason.value.version,
    });
    expect(closeVotingNoReason.ok).toBe(true);
    if (!closeVotingNoReason.ok) return;

    const closeMissingReason = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: id,
      action: "close",
      expectedWorkflowState: "voting_closed",
      expectedVersion: closeVotingNoReason.value.version,
    });
    expect(closeMissingReason.ok).toBe(false);
    if (!closeMissingReason.ok) {
      expect(closeMissingReason.code).toBe("CONSULTATION_REASON_REQUIRED");
    }

    const closed = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: id,
      action: "close",
      expectedWorkflowState: "voting_closed",
      expectedVersion: closeVotingNoReason.value.version,
      reason: "Consultation window has ended.",
    });
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.value.workflowState).toBe("closed");

    const archived = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: id,
      action: "archive",
      expectedWorkflowState: "closed",
      expectedVersion: closed.value.version,
      reason: "Archiving completed consultation.",
    });
    expect(archived.ok).toBe(true);
    if (!archived.ok) return;
    expect(archived.value.workflowState).toBe("archived");

    // No forward-pipeline rule has `from: "archived"` for any action, so this
    // is denied at the rule-lookup stage — archived is terminal.
    const afterArchiveTerminal = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: id,
      action: "mark_ready",
      expectedWorkflowState: "archived",
      expectedVersion: archived.value.version,
    });
    expect(afterArchiveTerminal.ok).toBe(false);
    if (!afterArchiveTerminal.ok) {
      expect(afterArchiveTerminal.code).toBe("CONSULTATION_TRANSITION_DENIED");
    }
  });

  it("rejects a stale expected-version transition (optimistic concurrency)", async () => {
    const topicId = await freshTopicId();
    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Concurrency fixture",
      publicPrompt: "Concurrency fixture prompt",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const [first, second] = await Promise.all([
      transitionConversation(db, {
        actorAccountId: ADMIN,
        conversationId: created.value.id,
        action: "mark_ready",
        expectedWorkflowState: "draft",
        expectedVersion: created.value.version,
      }),
      transitionConversation(db, {
        actorAccountId: ADMIN,
        conversationId: created.value.id,
        action: "mark_ready",
        expectedWorkflowState: "draft",
        expectedVersion: created.value.version,
      }),
    ]);
    const results = [first, second];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.some((r) => !r.ok)).toBe(true);
    const failure = results.find((r) => !r.ok);
    if (failure && !failure.ok) {
      expect(failure.code).toBe("CONSULTATION_STATE_CONFLICT");
    }

    const stale = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      action: "open",
      expectedWorkflowState: "ready",
      expectedVersion: created.value.version, // stale — already bumped above
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("CONSULTATION_STATE_CONFLICT");
  });

  it("supports a recovery transition with a substantive reason, distinct from ordinary transitions", async () => {
    const topicId = await freshTopicId();
    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Recovery fixture",
      publicPrompt: "Recovery fixture prompt",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const ready = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      action: "mark_ready",
      expectedWorkflowState: "draft",
      expectedVersion: created.value.version,
    });
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;

    const opened = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      action: "open",
      expectedWorkflowState: "ready",
      expectedVersion: ready.value.version,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    // Omitting `reason` entirely (rather than passing a too-short string,
    // which the zod schema itself would reject as CONSULTATION_INPUT_INVALID)
    // exercises the isSubstantiveReason recovery-specific gate.
    const recoveryWithoutReason = await recoverConversation(
      db,
      {
        actorAccountId: ADMIN,
        conversationId: created.value.id,
        expectedWorkflowState: "open",
        targetWorkflowState: "ready",
        expectedVersion: opened.value.version,
      } as Parameters<typeof recoverConversation>[1],
    );
    expect(recoveryWithoutReason.ok).toBe(false);
    if (!recoveryWithoutReason.ok) {
      expect(recoveryWithoutReason.code).toBe("CONSULTATION_REASON_REQUIRED");
    }

    const recoveryTooShortReason = await recoverConversation(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedWorkflowState: "open",
      targetWorkflowState: "ready",
      expectedVersion: opened.value.version,
      reason: "short",
    });
    expect(recoveryTooShortReason.ok).toBe(false);
    if (!recoveryTooShortReason.ok) {
      expect(recoveryTooShortReason.code).toBe("CONSULTATION_INPUT_INVALID");
    }

    const recovered = await recoverConversation(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedWorkflowState: "open",
      targetWorkflowState: "ready",
      expectedVersion: opened.value.version,
      reason: "Opened before staff finished configuring the prompt.",
    });
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;
    expect(recovered.value.workflowState).toBe("ready");

    const [recoveryAudit] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectId, created.value.id),
          eq(auditEvents.action, "consultations.recovery_transition"),
        ),
      );
    expect(recoveryAudit).toBeTruthy();

    const disallowedRecovery = await recoverConversation(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedWorkflowState: "ready",
      targetWorkflowState: "closed",
      expectedVersion: recovered.value.version,
      reason: "Not an allowed recovery pair.",
    });
    expect(disallowedRecovery.ok).toBe(false);
    if (!disallowedRecovery.ok) {
      expect(disallowedRecovery.code).toBe("CONSULTATION_TRANSITION_DENIED");
    }
  });

  it("changes provider availability independently of workflow state", async () => {
    const topicId = await freshTopicId();
    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Availability fixture",
      publicPrompt: "Availability fixture prompt",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.providerAvailability).toBe("not_configured");

    const updated = await setProviderAvailability(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedVersion: created.value.version,
      availability: "degraded",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.providerAvailability).toBe("degraded");
    // Workflow state is a fully independent axis.
    expect(updated.value.workflowState).toBe("draft");
    expect(updated.value.version).toBe(created.value.version + 1);

    const staleAvailability = await setProviderAvailability(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedVersion: created.value.version, // stale
      availability: "available",
    });
    expect(staleAvailability.ok).toBe(false);
    if (!staleAvailability.ok) {
      expect(staleAvailability.code).toBe("CONSULTATION_STATE_CONFLICT");
    }
  });

  it("attaches, rotates, and removes a provider mapping without ever auditing the raw ref", async () => {
    const topicId = await freshTopicId();
    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Mapping fixture",
      publicPrompt: "Mapping fixture prompt",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const attached = await attachProviderMapping(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedVersion: created.value.version,
    });
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;
    expect(attached.value.providerKind).toBe("fixture");
    expect(attached.value.providerConversationRef).toMatch(/^fixture-conv:/);
    expect(attached.value.configurationVersion).toBe(2);

    const doubleAttach = await attachProviderMapping(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedVersion: attached.value.version,
    });
    expect(doubleAttach.ok).toBe(false);
    if (!doubleAttach.ok) {
      expect(doubleAttach.code).toBe("CONSULTATION_MAPPING_ALREADY_ATTACHED");
    }

    const rotated = await rotateProviderMapping(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedVersion: attached.value.version,
    });
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    expect(rotated.value.providerConversationRef).not.toBe(
      attached.value.providerConversationRef,
    );
    expect(rotated.value.configurationVersion).toBe(3);

    const removed = await removeProviderMapping(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedVersion: rotated.value.version,
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.value.providerKind).toBe("none");
    expect(removed.value.providerConversationRef).toBeNull();
    expect(removed.value.configurationVersion).toBe(4);

    const mappingAudits = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectId, created.value.id),
          eq(auditEvents.action, "consultations.mapping_attached"),
        ),
      );
    expect(mappingAudits).toHaveLength(1);
    const serializedAudits = JSON.stringify(mappingAudits);
    expect(serializedAudits).not.toContain(
      attached.value.providerConversationRef ?? "__never__",
    );
    expect(serializedAudits).not.toContain("providerConversationRef");
  });

  it("public consultation view never includes providerConversationRef and hides drafts", async () => {
    const topicId = await freshTopicId();
    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Public projection fixture",
      publicPrompt: "Public projection fixture prompt",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const draftView = await getPublicConsultationView(db, topicId);
    expect(draftView.ok).toBe(true);
    if (draftView.ok) expect(draftView.value).toBeNull();

    const ready = await transitionConversation(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      action: "mark_ready",
      expectedWorkflowState: "draft",
      expectedVersion: created.value.version,
    });
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;

    const attached = await attachProviderMapping(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedVersion: ready.value.version,
    });
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;

    const publicView = await getPublicConsultationView(db, topicId);
    expect(publicView.ok).toBe(true);
    if (!publicView.ok || !publicView.value) return;
    expect(publicView.value.topicId).toBe(topicId);
    expect(publicView.value.workflowState).toBe("ready");
    expect("providerConversationRef" in publicView.value).toBe(false);
    expect(JSON.stringify(publicView.value)).not.toContain(
      attached.value.providerConversationRef ?? "__never__",
    );
    expect(() => assertNoProviderRefLeak(publicView.value as object)).not.toThrow();

    const staffSummary = await getStaffConsultationSummary(db, topicId);
    expect(staffSummary.ok).toBe(true);
    if (!staffSummary.ok || !staffSummary.value) return;
    expect(staffSummary.value.hasProviderMapping).toBe(true);
    expect("providerConversationRef" in staffSummary.value).toBe(false);
    expect(JSON.stringify(staffSummary.value)).not.toContain(
      attached.value.providerConversationRef ?? "__never__",
    );
    expect(() => assertNoProviderRefLeak(staffSummary.value as object)).not.toThrow();
  });

  it("never persists a live provider kind (DB CHECK constraint fails closed)", async () => {
    const topicId = await freshTopicId();
    const created = await createConversation(db, {
      actorAccountId: ADMIN,
      topicId,
      publicTitle: "Live provider rejection fixture",
      publicPrompt: "Live provider rejection fixture prompt",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const deniedMapping = await attachProviderMapping(db, {
      actorAccountId: ADMIN,
      conversationId: created.value.id,
      expectedVersion: created.value.version,
      providerKind: "polis_hosted",
    });
    expect(deniedMapping.ok).toBe(false);
    if (!deniedMapping.ok) {
      expect(deniedMapping.code).toBe("LIVE_PROVIDER_KIND_FORBIDDEN");
    }

    await expect(
      db.insert(publicInputConversations).values({
        id: "pinconv-direct-live-attempt",
        topicId,
        providerKind: "polis_hosted",
        workflowState: "draft",
        providerAvailability: "not_configured",
        publicTitle: "Direct insert should fail",
        publicPrompt: "Direct insert should fail",
        createdByAccountId: ADMIN,
        designation: "historical",
        synthetic: true,
      }),
    ).rejects.toThrow();

    const stillNone = await getConversationById(db, created.value.id);
    expect(stillNone.ok).toBe(true);
    if (stillNone.ok) {
      expect(stillNone.value?.providerKind).toBe("none");
    }
  });
});
