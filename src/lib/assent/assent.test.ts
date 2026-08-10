import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import {
  accounts,
  assentRecords,
  documentVersions,
  persons,
  roleAssignments,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import {
  createDraftDocument,
  hashDocumentBody,
  markCounselReviewed,
  publishDocument,
} from "@/lib/assent/documents";
import { declineDocument, withdrawAssent } from "@/lib/assent/outcomes";
import { openDocumentPresentation } from "@/lib/assent/presentation";
import { recordAssent } from "@/lib/assent/record-assent";
import {
  listAssentHistoryWithOutcomes,
  mapActiveAccountToApplicableDocuments,
} from "@/lib/assent/status";
import { newEntityId } from "@/lib/auth/tokens";

const ADMIN_ID = "account-ostt-synth-doc-admin";

async function insertActiveAdmin(
  db: Awaited<ReturnType<typeof createTestDatabase>>["db"],
) {
  const personId = newEntityId("person");
  await db.insert(persons).values({
    id: personId,
    synthetic: true,
    displayLabel: "ostt-synth Doc Admin",
  });
  await db.insert(accounts).values({
    id: ADMIN_ID,
    personId,
    contactChannel: "doc-admin@ostt.synth.test",
    lifecycleState: "active",
    synthetic: true,
    contactVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    activatedAt: new Date("2026-08-02T00:00:00.000Z"),
  });
  await db.insert(roleAssignments).values({
    id: newEntityId("role"),
    accountId: ADMIN_ID,
    role: "administrator",
    grantedByLabel: "ostt-synth-assent-test",
    reason: "Publish documents in assent tests.",
  });
}

describe("versioned documents and assent (2.6)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];

  beforeAll(async () => {
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
    await insertActiveAdmin(db);
  }, 120_000);

  afterAll(async () => {
    await client.close();
  });

  it("maps an account to exact applicable published document versions", async () => {
    const mapped = await mapActiveAccountToApplicableDocuments(
      db,
      "account-ostt-synth-ada",
    );
    expect(mapped.some((row) => row.kind === "privacy_notice")).toBe(true);
    const privacy = mapped.find((row) => row.kind === "privacy_notice");
    expect(privacy?.requiresAssent).toBe(false);
    expect(privacy?.latestAssentId).toBe("assent-ostt-synth-ada-privacy-v1");
    expect(privacy?.reviewPath).toContain("/account/assent/review/");
    expect(
      (privacy as { body?: string } | undefined)?.body,
    ).toBeUndefined();
  });

  it("rejects draft→published without counsel_reviewed and unauthorized publishers", async () => {
    const draft = await createDraftDocument(db, {
      kind: "conduct",
      versionLabel: "v-bad-legal",
      title: "Conduct",
      body: "This text is Not legally reviewed and must not publish.",
      requiredNotices: ["conduct-notice"],
      actorAccountId: ADMIN_ID,
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    const fromDraft = await publishDocument(db, {
      documentVersionId: draft.value.id,
      actorAccountId: ADMIN_ID,
    });
    expect(fromDraft.ok).toBe(false);
    if (!fromDraft.ok) {
      expect(fromDraft.code).toBe("ASSENT_DOC_STATE");
    }

    await markCounselReviewed(db, {
      documentVersionId: draft.value.id,
      actorAccountId: ADMIN_ID,
    });

    const published = await publishDocument(db, {
      documentVersionId: draft.value.id,
      actorAccountId: ADMIN_ID,
    });
    expect(published.ok).toBe(false);
    if (!published.ok) {
      expect(published.code).toBe("ASSENT_NOT_LEGALLY_REVIEWED");
    }

    const denied = await createDraftDocument(db, {
      kind: "conduct",
      versionLabel: "v-unauthorized",
      title: "Unauthorized",
      body: "Should not create.",
      requiredNotices: [],
      actorAccountId: "account-ostt-synth-ada",
    });
    expect(denied.ok).toBe(false);
  });

  it("publishes only from counsel_reviewed, supersedes prior, and requires re-assent", async () => {
    const draft = await createDraftDocument(db, {
      kind: "privacy_notice",
      versionLabel: "v2-synth",
      title: "Synthetic privacy notice v2",
      body: "Updated synthetic privacy notice for re-assent tests.",
      requiredNotices: ["synthetic-notice", "privacy-summary"],
      actorAccountId: ADMIN_ID,
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    await markCounselReviewed(db, {
      documentVersionId: draft.value.id,
      actorAccountId: ADMIN_ID,
    });

    const published = await publishDocument(db, {
      documentVersionId: draft.value.id,
      actorAccountId: ADMIN_ID,
    });
    expect(published.ok).toBe(true);

    const [prior] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, "doc-ostt-synth-privacy-v1"));
    expect(prior?.state).toBe("superseded");
    expect(prior?.supersededAt).toBeTruthy();

    const [fresh] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, draft.value.id));
    expect(fresh?.publishedByAccountId).toBe(ADMIN_ID);
    expect(fresh?.counselReviewedAt).toBeTruthy();

    const mapped = await mapActiveAccountToApplicableDocuments(
      db,
      "account-ostt-synth-ada",
    );
    const privacy = mapped.find((row) => row.kind === "privacy_notice");
    expect(privacy?.documentVersionId).toBe(draft.value.id);
    expect(privacy?.requiresAssent).toBe(true);

    const historyBefore = await listAssentHistoryWithOutcomes(
      db,
      "account-ostt-synth-ada",
    );
    expect(
      historyBefore.some(
        (row) =>
          row.entryKind === "assent" &&
          row.assentId === "assent-ostt-synth-ada-privacy-v1",
      ),
    ).toBe(true);

    const presentation = await openDocumentPresentation(db, {
      accountId: "account-ostt-synth-ada",
      documentVersionId: draft.value.id,
    });
    expect(presentation.ok).toBe(true);
    if (!presentation.ok) {
      return;
    }

    const incomplete = await recordAssent(db, {
      accountId: "account-ostt-synth-ada",
      documentVersionId: draft.value.id,
      presentationId: presentation.value.presentationId,
      method: "gated-ui",
      noticesAcknowledged: ["synthetic-notice"],
    });
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) {
      expect(incomplete.code).toBe("ASSENT_NOTICES_INCOMPLETE");
    }

    const presentation2 = await openDocumentPresentation(db, {
      accountId: "account-ostt-synth-ada",
      documentVersionId: draft.value.id,
    });
    expect(presentation2.ok).toBe(true);
    if (!presentation2.ok) {
      return;
    }

    const reassent = await recordAssent(db, {
      accountId: "account-ostt-synth-ada",
      documentVersionId: draft.value.id,
      presentationId: presentation2.value.presentationId,
      method: "gated-ui",
      noticesAcknowledged: ["synthetic-notice", "privacy-summary"],
    });
    expect(reassent.ok).toBe(true);
  });

  it("rejects in-place mutation of published document content", async () => {
    const [published] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.state, "published"));
    expect(published).toBeTruthy();

    await expect(
      db
        .update(documentVersions)
        .set({ body: "tampered body", contentHash: hashDocumentBody("tampered") })
        .where(eq(documentVersions.id, published!.id)),
    ).rejects.toThrow();
  });

  it("rejects assent without a valid presentation (no client hash echo)", async () => {
    const [published] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.state, "published"));

    const result = await recordAssent(db, {
      accountId: "account-ostt-synth-ben",
      documentVersionId: published!.id,
      presentationId: "present-missing",
      method: "gated-ui",
      noticesAcknowledged: published!.requiredNotices,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ASSENT_PRESENTATION_INVALID");
    }
  });

  it("clears current assent after withdrawal and shows outcomes in history", async () => {
    const conduct = await createDraftDocument(db, {
      kind: "conduct",
      versionLabel: "v1-synth-conduct",
      title: "Synthetic conduct terms",
      body: "Synthetic conduct terms for decline/withdraw tests.",
      requiredNotices: ["conduct-summary"],
      actorAccountId: ADMIN_ID,
    });
    expect(conduct.ok).toBe(true);
    if (!conduct.ok) {
      return;
    }
    await markCounselReviewed(db, {
      documentVersionId: conduct.value.id,
      actorAccountId: ADMIN_ID,
    });
    await publishDocument(db, {
      documentVersionId: conduct.value.id,
      actorAccountId: ADMIN_ID,
    });

    const declinePresentation = await openDocumentPresentation(db, {
      accountId: "account-ostt-synth-ben",
      documentVersionId: conduct.value.id,
    });
    expect(declinePresentation.ok).toBe(true);
    if (!declinePresentation.ok) {
      return;
    }

    const declined = await declineDocument(db, {
      accountId: "account-ostt-synth-ben",
      documentVersionId: conduct.value.id,
      presentationId: declinePresentation.value.presentationId,
      reason: "Declining for synthetic test coverage.",
    });
    expect(declined.ok).toBe(true);

    const assentPresentation = await openDocumentPresentation(db, {
      accountId: "account-ostt-synth-ben",
      documentVersionId: conduct.value.id,
    });
    expect(assentPresentation.ok).toBe(true);
    if (!assentPresentation.ok) {
      return;
    }

    const assented = await recordAssent(db, {
      accountId: "account-ostt-synth-ben",
      documentVersionId: conduct.value.id,
      presentationId: assentPresentation.value.presentationId,
      method: "gated-ui",
      noticesAcknowledged: ["conduct-summary"],
    });
    expect(assented.ok).toBe(true);
    if (!assented.ok) {
      return;
    }

    let mapped = await mapActiveAccountToApplicableDocuments(
      db,
      "account-ostt-synth-ben",
    );
    expect(
      mapped.find((row) => row.documentVersionId === conduct.value.id)
        ?.requiresAssent,
    ).toBe(false);

    const withdrawn = await withdrawAssent(db, {
      accountId: "account-ostt-synth-ben",
      assentId: assented.value.assentId,
      reason: "Withdrawing for synthetic retention coverage.",
    });
    expect(withdrawn.ok).toBe(true);

    const repeated = await withdrawAssent(db, {
      accountId: "account-ostt-synth-ben",
      assentId: assented.value.assentId,
      reason: "Second withdrawal must fail.",
    });
    expect(repeated.ok).toBe(false);

    mapped = await mapActiveAccountToApplicableDocuments(
      db,
      "account-ostt-synth-ben",
    );
    expect(
      mapped.find((row) => row.documentVersionId === conduct.value.id)
        ?.requiresAssent,
    ).toBe(true);

    const history = await listAssentHistoryWithOutcomes(
      db,
      "account-ostt-synth-ben",
    );
    expect(
      history.some(
        (row) =>
          row.entryKind === "outcome" &&
          row.outcome === "withdrawn" &&
          row.priorAssentId === assented.value.assentId,
      ),
    ).toBe(true);
    expect(
      history.some(
        (row) =>
          row.entryKind === "outcome" && row.outcome === "declined",
      ),
    ).toBe(true);
    expect(
      history.some(
        (row) =>
          row.entryKind === "assent" &&
          row.assentId === assented.value.assentId &&
          row.isCurrentPublished === false &&
          row.wasWithdrawn === true,
      ),
    ).toBe(true);

    const [retained] = await db
      .select()
      .from(assentRecords)
      .where(eq(assentRecords.id, assented.value.assentId));
    expect(retained).toBeTruthy();

    await expect(
      db
        .delete(assentRecords)
        .where(eq(assentRecords.id, assented.value.assentId)),
    ).rejects.toThrow();
  });
});
