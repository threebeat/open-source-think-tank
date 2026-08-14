/**
 * PostgreSQL concurrency proofs for Public Input report integrity (4.5A.1).
 * Uses separate pooled connections and Promise.all barriers — not sequential replay.
 *
 * Run: npm run db:up && npm run test:pg:reports
 * Requires OSTT_REQUIRE_POSTGRES=1 in CI; skips when Postgres is unreachable locally.
 */
import path from "node:path";

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import {
  publicInputReportFindings,
  publicInputReportGroups,
  publicInputReports,
} from "@/db/schema";
import { seedSyntheticFoundation } from "@/db/seeds/synthetic";
import type { FoundationDb } from "@/db/types";
import { decideFindingPublication } from "@/lib/public-input/moderation/service";
import {
  createConversation,
  transitionConversation,
} from "@/lib/public-input/lifecycle/service";
import { CANONICAL_IMPORT_SCHEMA_VERSION } from "@/lib/public-input/reports/canonical-schema";
import {
  beginReview,
  importAggregateReport,
  publishReport,
  validateReport,
} from "@/lib/public-input/reports/service";
import { createTopic } from "@/lib/topics/authoring";

const ADMIN = "account-ostt-synth-staff-admin";

const ADMIN_URL =
  process.env.OSTT_PG_ADMIN_URL?.trim() ||
  "postgres://ostt:ostt@127.0.0.1:54329/postgres";
const REPORT_DB = "ostt_report_integrity";
const PG_URL =
  process.env.OSTT_PG_REPORT_TEST_URL?.trim() ||
  `postgres://ostt:ostt@127.0.0.1:54329/${REPORT_DB}`;
const REQUIRE_PG = process.env.OSTT_REQUIRE_POSTGRES === "1";

function parseDbName(url: string): string {
  try {
    return decodeURIComponent(
      new URL(url).pathname.replace(/^\//, "").split("/")[0] ?? "",
    );
  } catch {
    return "";
  }
}

async function postgresReachable(): Promise<boolean> {
  if (parseDbName(PG_URL) !== REPORT_DB) {
    if (REQUIRE_PG) {
      throw new Error(
        `Report concurrency proof must target disposable DB "${REPORT_DB}" (got "${parseDbName(PG_URL)}")`,
      );
    }
    return false;
  }
  if (parseDbName(PG_URL) === "ostt_dev") {
    throw new Error("Report concurrency proof must not use ostt_dev");
  }

  const probe = postgres(ADMIN_URL, { max: 1, connect_timeout: 2 });
  try {
    await probe`select 1`;
    await probe.unsafe(`CREATE DATABASE ${REPORT_DB}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !/already exists/i.test(message) &&
      !/duplicate_database/i.test(message)
    ) {
      if (/connect|ECONNREFUSED|timeout|does not exist/i.test(message)) {
        await probe.end({ timeout: 1 }).catch(() => undefined);
        return false;
      }
    }
  } finally {
    await probe.end({ timeout: 1 }).catch(() => undefined);
  }

  const check = postgres(PG_URL, { max: 1, connect_timeout: 2 });
  try {
    await check`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await check.end({ timeout: 1 }).catch(() => undefined);
  }
}

const reachable = await postgresReachable();
if (REQUIRE_PG && !reachable) {
  throw new Error(
    "OSTT_REQUIRE_POSTGRES=1 but PostgreSQL is unreachable for report concurrency proof",
  );
}

function fixturePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: CANONICAL_IMPORT_SCHEMA_VERSION,
    sourceKind: "fixture" as const,
    methodVersion: "polis-export-v1",
    providerExportVersionLabel: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
    publicTitle: "Community input on billing changes",
    participationCount: 100,
    commentCount: 42,
    voteCount: 900,
    participationSufficiency: "Sufficient participation for this topic scope.",
    representationLimitations:
      "Self-selected online sample; not demographically representative.",
    opinionGroups: [
      { label: "Group A", participantCount: 50 },
      { label: "Group B", participantCount: 48 },
      { label: "Group C", participantCount: 2 },
    ],
    crossGroupAgreement: ["Most participants agreed on statement one."],
    meaningfulDisagreement: ["Participants disagreed on statement two."],
    ...overrides,
  };
}

describe.skipIf(!reachable)(
  "Public Input report concurrency (PostgreSQL 16 / 4.5A.1)",
  () => {
    let sqlClient: ReturnType<typeof postgres>;
    let db: FoundationDb;
    let previousEnv: Record<string, string | undefined>;
    let topicCounter = 0;

    beforeAll(async () => {
      previousEnv = {
        APP_MODE: process.env.APP_MODE,
        DATABASE_URL: process.env.DATABASE_URL,
        OSTT_ALLOW_NON_SYNTHETIC_REPORT_PUBLISH:
          process.env.OSTT_ALLOW_NON_SYNTHETIC_REPORT_PUBLISH,
      };
      process.env.APP_MODE = "gated";
      process.env.DATABASE_URL = PG_URL;
      delete process.env.OSTT_ALLOW_NON_SYNTHETIC_REPORT_PUBLISH;

      sqlClient = postgres(PG_URL, { max: 12 });
      await sqlClient.unsafe(`
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        DROP SCHEMA IF EXISTS drizzle CASCADE;
      `);
      db = drizzle(sqlClient, { schema });
      await migrate(db, {
        migrationsFolder: path.join(process.cwd(), "drizzle"),
      });
      await seedSyntheticFoundation(db);
    }, 240_000);

    afterAll(async () => {
      await sqlClient?.end({ timeout: 5 });
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    async function freshVotingClosedConversationId(): Promise<string> {
      topicCounter += 1;
      const createdTopic = await createTopic(db, {
        actorAccountId: ADMIN,
        slug: `pinrpt-pg-topic-${topicCounter}`,
        title: `Report concurrency topic ${topicCounter}`,
        question: "What should change?",
        background: "Background for report concurrency proof.",
        scope: "Alpha test scope.",
        jurisdictionLevel: "statewide",
        countyFips: null,
      });
      expect(createdTopic.ok).toBe(true);
      if (!createdTopic.ok) throw new Error("topic create failed");

      const created = await createConversation(db, {
        actorAccountId: ADMIN,
        topicId: createdTopic.value.id,
        publicTitle: "Concurrency consultation",
        publicPrompt: "What tradeoffs matter?",
      });
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error("conversation create failed");

      let version = created.value.version;
      let state = created.value.workflowState;
      for (const action of [
        "mark_ready",
        "open",
        "close_commenting",
        "close_voting",
      ] as const) {
        const result = await transitionConversation(db, {
          actorAccountId: ADMIN,
          conversationId: created.value.id,
          action,
          expectedWorkflowState: state,
          expectedVersion: version,
        });
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(`transition ${action} failed`);
        version = result.value.version;
        state = result.value.workflowState;
      }
      return created.value.id;
    }

    async function closeConversation(conversationId: string): Promise<void> {
      const { getConversationById } = await import(
        "@/lib/public-input/lifecycle/repository"
      );
      const current = await getConversationById(db, conversationId);
      expect(current.ok && current.value).toBeTruthy();
      if (!current.ok || !current.value) throw new Error("missing conversation");
      const closed = await transitionConversation(db, {
        actorAccountId: ADMIN,
        conversationId,
        action: "close",
        expectedWorkflowState: current.value.workflowState,
        expectedVersion: current.value.version,
        reason: "Voting window elapsed; closing consultation for reporting.",
      });
      expect(closed.ok).toBe(true);
    }

    async function importValidateReview(conversationId: string, payload: Record<string, unknown>) {
      const imported = await importAggregateReport(db, {
        actorAccountId: ADMIN,
        conversationId,
        payload,
      });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error("import failed");
      const validated = await validateReport(db, {
        actorAccountId: ADMIN,
        reportId: imported.value.reportId,
        expectedConcurrencyVersion: 1,
      });
      expect(validated.ok).toBe(true);
      if (!validated.ok) throw new Error("validate failed");
      const reviewed = await beginReview(db, {
        actorAccountId: ADMIN,
        reportId: imported.value.reportId,
        expectedConcurrencyVersion: validated.value.concurrencyVersion,
      });
      expect(reviewed.ok).toBe(true);
      if (!reviewed.ok) throw new Error("review failed");
      return reviewed.value;
    }

    it("identical simultaneous imports resolve to one version via lock + idempotent replay", async () => {
      const conversationId = await freshVotingClosedConversationId();
      const payload = fixturePayload({
        publicTitle: "Identical concurrent import",
      });

      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          importAggregateReport(db, {
            actorAccountId: ADMIN,
            conversationId,
            payload,
          }),
        ),
      );

      const ok = results.filter((r) => r.ok);
      expect(ok.length).toBe(8);
      const reportIds = new Set(
        ok.map((r) => (r.ok ? r.value.reportId : "")),
      );
      const versions = new Set(
        ok.map((r) => (r.ok ? r.value.reportVersion : -1)),
      );
      expect(reportIds.size).toBe(1);
      expect(versions.size).toBe(1);
      expect(ok.some((r) => r.ok && r.value.isIdempotentReplay)).toBe(true);
      expect(ok.some((r) => r.ok && !r.value.isIdempotentReplay)).toBe(true);

      const rows = await db
        .select()
        .from(publicInputReports)
        .where(eq(publicInputReports.conversationId, conversationId));
      expect(rows).toHaveLength(1);
    }, 90_000);

    it("different simultaneous imports allocate distinct versions without collision", async () => {
      const conversationId = await freshVotingClosedConversationId();

      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          importAggregateReport(db, {
            actorAccountId: ADMIN,
            conversationId,
            payload: fixturePayload({
              publicTitle: `Distinct concurrent import ${i}`,
              methodVersion: `method-v-${i}`,
            }),
          }),
        ),
      );

      const ok = results.filter((r) => r.ok);
      expect(ok.length).toBe(5);
      const versions = ok.map((r) => (r.ok ? r.value.reportVersion : -1)).sort();
      expect(versions).toEqual([1, 2, 3, 4, 5]);

      const rows = await db
        .select()
        .from(publicInputReports)
        .where(eq(publicInputReports.conversationId, conversationId));
      expect(rows).toHaveLength(5);
    }, 90_000);

    it("two concurrent publishers leave exactly one is_latest_published report", async () => {
      const conversationId = await freshVotingClosedConversationId();
      const first = await importValidateReview(
        conversationId,
        fixturePayload({ publicTitle: "Publisher race A" }),
      );
      const secondImport = await importAggregateReport(db, {
        actorAccountId: ADMIN,
        conversationId,
        payload: fixturePayload({
          publicTitle: "Publisher race B",
          methodVersion: "method-b",
        }),
      });
      expect(secondImport.ok).toBe(true);
      if (!secondImport.ok) throw new Error("second import failed");
      const secondValidated = await validateReport(db, {
        actorAccountId: ADMIN,
        reportId: secondImport.value.reportId,
        expectedConcurrencyVersion: 1,
      });
      expect(secondValidated.ok).toBe(true);
      if (!secondValidated.ok) throw new Error("second validate failed");
      const secondReviewed = await beginReview(db, {
        actorAccountId: ADMIN,
        reportId: secondImport.value.reportId,
        expectedConcurrencyVersion: secondValidated.value.concurrencyVersion,
      });
      expect(secondReviewed.ok).toBe(true);
      if (!secondReviewed.ok) throw new Error("second review failed");
      const second = secondReviewed.value;

      await closeConversation(conversationId);

      const raced = await Promise.all([
        publishReport(db, {
          actorAccountId: ADMIN,
          reportId: first.id,
          expectedConcurrencyVersion: first.concurrencyVersion,
        }),
        publishReport(db, {
          actorAccountId: ADMIN,
          reportId: second.id,
          expectedConcurrencyVersion: second.concurrencyVersion,
        }),
      ]);

      const successes = raced.filter((r) => r.ok);
      const failures = raced.filter((r) => !r.ok);
      expect(successes.length).toBeGreaterThanOrEqual(1);
      expect(successes.length + failures.length).toBe(2);

      const latest = await db
        .select()
        .from(publicInputReports)
        .where(eq(publicInputReports.isLatestPublished, true));
      const forConversation = latest.filter(
        (row) => row.conversationId === conversationId,
      );
      expect(forConversation).toHaveLength(1);
      expect(
        forConversation[0]!.id === first.id ||
          forConversation[0]!.id === second.id,
      ).toBe(true);
    }, 90_000);

    it("finding moderation racing publication: post-publish child mutation fails", async () => {
      const conversationId = await freshVotingClosedConversationId();
      const report = await importValidateReview(
        conversationId,
        fixturePayload({ publicTitle: "Finding vs publish race" }),
      );
      await closeConversation(conversationId);

      const findings = await db
        .select()
        .from(publicInputReportFindings)
        .where(eq(publicInputReportFindings.reportId, report.id));
      expect(findings.length).toBeGreaterThan(0);
      const findingId = findings[0]!.id;

      // Barrier: both start after each has begun a transaction intent via Promise.all.
      const [published, moderated] = await Promise.all([
        publishReport(db, {
          actorAccountId: ADMIN,
          reportId: report.id,
          expectedConcurrencyVersion: report.concurrencyVersion,
        }),
        decideFindingPublication(db, {
          actorAccountId: ADMIN,
          reportId: report.id,
          findingId,
          action: "withhold",
          expectedConcurrencyVersion: report.concurrencyVersion,
          publicRationale: "Race-test withhold rationale for published lock.",
        }),
      ]);

      // Exactly one of the two concurrent operations that share the concurrency
      // token may succeed; the other must conflict or be rejected by workflow.
      const outcomes = [published.ok, moderated.ok];
      expect(outcomes.filter(Boolean).length).toBe(1);

      if (published.ok) {
        expect(moderated.ok).toBe(false);
        if (!moderated.ok) {
          expect([
            "PUBLIC_INPUT_REPORT_STATE_CONFLICT",
            "PUBLIC_INPUT_REPORT_NOT_UNDER_REVIEW",
          ]).toContain(moderated.code);
        }
        // Direct SQL must also fail after publish.
        let directFailed = false;
        try {
          await db
            .update(publicInputReportFindings)
            .set({ publicationStatus: "withheld" })
            .where(eq(publicInputReportFindings.id, findingId));
        } catch {
          directFailed = true;
        }
        expect(directFailed).toBe(true);
      }
    }, 90_000);

    it("direct SQL cannot insert/delete children or mutate immutable report columns after create", async () => {
      const conversationId = await freshVotingClosedConversationId();
      const report = await importValidateReview(
        conversationId,
        fixturePayload({ publicTitle: "Direct SQL immutability" }),
      );

      let titleFailed = false;
      try {
        await db
          .update(publicInputReports)
          .set({ publicTitle: "Mutated in place" })
          .where(eq(publicInputReports.id, report.id));
      } catch {
        titleFailed = true;
      }
      expect(titleFailed).toBe(true);

      let insertFailed = false;
      try {
        await db.insert(publicInputReportGroups).values({
          id: "pinrgrp_illegal_insert",
          reportId: report.id,
          label: "Illegal Group",
          displayOrder: 99,
          participantCount: 1,
          rawShare: 0.01,
          publishedStatus: "reported",
          publishedShare: null,
          countProvenance: "exact",
          dataProvenance: "synthetic_fixture",
          synthetic: true,
        });
      } catch {
        insertFailed = true;
      }
      expect(insertFailed).toBe(true);

      const groups = await db
        .select()
        .from(publicInputReportGroups)
        .where(eq(publicInputReportGroups.reportId, report.id));
      expect(groups.length).toBeGreaterThan(0);

      let deleteFailed = false;
      try {
        await db
          .delete(publicInputReportGroups)
          .where(eq(publicInputReportGroups.id, groups[0]!.id));
      } catch {
        deleteFailed = true;
      }
      expect(deleteFailed).toBe(true);

      // Illegal workflow jump under_review → superseded must fail (matrix).
      let jumpFailed = false;
      try {
        await db.execute(sql`
          UPDATE public_input_reports
          SET workflow_state = 'superseded',
              superseded_by_report_id = ${report.id},
              is_latest_published = false,
              concurrency_version = concurrency_version + 1
          WHERE id = ${report.id}
        `);
      } catch {
        jumpFailed = true;
      }
      expect(jumpFailed).toBe(true);
    }, 90_000);
  },
);
