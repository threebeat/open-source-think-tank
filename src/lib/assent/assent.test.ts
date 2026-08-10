import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase } from "@/db/pglite";
import { assentRecords, documentVersions } from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import {
  createDraftDocument,
  hashDocumentBody,
  markCounselReviewed,
  publishDocument,
} from "@/lib/assent/documents";
import { declineDocument, withdrawAssent } from "@/lib/assent/outcomes";
import {
  listAssentHistory,
  mapActiveAccountToApplicableDocuments,
  recordAssent,
} from "@/lib/assent/record-assent";

describe("versioned documents and assent (2.6)", () => {
  let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
  let db: Awaited<ReturnType<typeof createTestDatabase>>["db"];

  beforeAll(async () => {
    const created = await createTestDatabase();
    client = created.client;
    db = created.db;
    await seedSyntheticFoundation(db);
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
  });

  it("rejects publishing or assenting to not-legally-reviewed placeholders", async () => {
    const draft = await createDraftDocument(db, {
      kind: "conduct",
      versionLabel: "v-bad-legal",
      title: "Conduct",
      body: "This text is Not legally reviewed and must not publish.",
      synthetic: true,
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    const published = await publishDocument(db, {
      documentVersionId: draft.value.id,
      synthetic: true,
    });
    expect(published.ok).toBe(false);
    if (!published.ok) {
      expect(published.code).toBe("ASSENT_NOT_LEGALLY_REVIEWED");
    }
  });

  it("publishes a new version, supersedes the prior, and requires re-assent", async () => {
    const draft = await createDraftDocument(db, {
      kind: "privacy_notice",
      versionLabel: "v2-synth",
      title: "Synthetic privacy notice v2",
      body: "Updated synthetic privacy notice for re-assent tests.",
      synthetic: true,
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) {
      return;
    }

    await markCounselReviewed(db, {
      documentVersionId: draft.value.id,
      synthetic: true,
    });

    const published = await publishDocument(db, {
      documentVersionId: draft.value.id,
      synthetic: true,
    });
    expect(published.ok).toBe(true);

    const [prior] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, "doc-ostt-synth-privacy-v1"));
    expect(prior?.state).toBe("superseded");
    expect(prior?.supersededAt).toBeTruthy();

    const mapped = await mapActiveAccountToApplicableDocuments(
      db,
      "account-ostt-synth-ada",
    );
    const privacy = mapped.find((row) => row.kind === "privacy_notice");
    expect(privacy?.documentVersionId).toBe(draft.value.id);
    expect(privacy?.requiresAssent).toBe(true);

    const historyBefore = await listAssentHistory(
      db,
      "account-ostt-synth-ada",
    );
    expect(
      historyBefore.some(
        (row) => row.assentId === "assent-ostt-synth-ada-privacy-v1",
      ),
    ).toBe(true);

    const reassent = await recordAssent(db, {
      accountId: "account-ostt-synth-ada",
      documentVersionId: draft.value.id,
      presentedContentHash: draft.value.contentHash,
      method: "gated-ui",
      noticesAcknowledged: ["privacy-summary"],
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

  it("rejects assent when the presented hash does not match", async () => {
    const [published] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.state, "published"));

    const result = await recordAssent(db, {
      accountId: "account-ostt-synth-ben",
      documentVersionId: published!.id,
      presentedContentHash: hashDocumentBody("wrong presentation"),
      method: "gated-ui",
      noticesAcknowledged: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ASSENT_HASH_MISMATCH");
    }
  });

  it("records decline and withdraw without erasing prior assent", async () => {
    const conduct = await createDraftDocument(db, {
      kind: "conduct",
      versionLabel: "v1-synth-conduct",
      title: "Synthetic conduct terms",
      body: "Synthetic conduct terms for decline/withdraw tests.",
      synthetic: true,
    });
    expect(conduct.ok).toBe(true);
    if (!conduct.ok) {
      return;
    }
    await publishDocument(db, {
      documentVersionId: conduct.value.id,
      synthetic: true,
    });

    const declined = await declineDocument(db, {
      accountId: "account-ostt-synth-ben",
      documentVersionId: conduct.value.id,
      presentedContentHash: conduct.value.contentHash,
      reason: "Declining for synthetic test coverage.",
    });
    expect(declined.ok).toBe(true);

    const assented = await recordAssent(db, {
      accountId: "account-ostt-synth-ben",
      documentVersionId: conduct.value.id,
      presentedContentHash: conduct.value.contentHash,
      method: "gated-ui",
      noticesAcknowledged: ["conduct-summary"],
    });
    expect(assented.ok).toBe(true);
    if (!assented.ok) {
      return;
    }

    const withdrawn = await withdrawAssent(db, {
      accountId: "account-ostt-synth-ben",
      assentId: assented.value.assentId,
      reason: "Withdrawing for synthetic retention coverage.",
    });
    expect(withdrawn.ok).toBe(true);

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
