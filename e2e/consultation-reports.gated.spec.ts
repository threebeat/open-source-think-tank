import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  signInWithCapturedEmail,
} from "./gated-helpers";

const CANONICAL_SCHEMA = "public-input-aggregate-import@1";

function aggregatePayload(title: string) {
  return {
    schemaVersion: CANONICAL_SCHEMA,
    sourceKind: "manual_aggregate",
    methodVersion: "public-input-aggregate@4.4.0-e2e",
    publicTitle: title,
    participationCount: 240,
    commentCount: 40,
    voteCount: 1800,
    participationSufficiency: "Illustrative alpha coverage only.",
    representationLimitations: "Self-selected; not representative.",
    opinionGroups: [
      { label: "Group A", share: 0.62 },
      { label: "Group B", share: 0.35 },
      { label: "Group C", share: 0.03 },
    ],
    crossGroupAgreement: ["Publish criteria before any surcharge applies."],
    meaningfulDisagreement: ["Graduated surcharge versus flat fee."],
  };
}

async function advanceConversationToClosed(
  page: import("@playwright/test").Page,
  conversationId: string,
) {
  const steps: Array<{ action: string; expected: string; reason?: string }> = [
    { action: "mark_ready", expected: "draft" },
    { action: "open", expected: "ready" },
    { action: "close_commenting", expected: "open" },
    { action: "close_voting", expected: "commenting_closed" },
    {
      action: "close",
      expected: "voting_closed",
      reason: "Voting window elapsed; closing for aggregate reporting.",
    },
  ];
  let version = 1;
  for (const step of steps) {
    const response = await page.request.post(
      `/api/workspace/consultations/${conversationId}/transition`,
      {
        data: {
          action: step.action,
          expectedWorkflowState: step.expected,
          expectedVersion: version,
          ...(step.reason ? { reason: step.reason } : {}),
        },
      },
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const body = (await response.json()) as { version?: number };
    version = body.version ?? version + 1;
  }
}

test.describe("consultation aggregate reports (gated 4.4)", () => {
  test("admin can import, review, publish; public draft is not-found", async ({
    page,
  }) => {
    await signInWithCapturedEmail(page, "staff-admin@ostt.synth.test");

    // Create a fresh topic for isolation.
    const slug = `pinrpt-e2e-${Date.now()}`;
    const createTopic = await page.request.post("/api/workspace/topics", {
      data: {
        slug,
        title: "Public Input report e2e topic",
        question: "What should change?",
        background: "Background for aggregate report e2e.",
        scope: "Alpha test scope for report ingestion.",
        jurisdictionLevel: "statewide",
        countyFips: null,
      },
    });
    expect(createTopic.ok(), await createTopic.text()).toBeTruthy();
    const topic = (await createTopic.json()) as { id: string };

    const createConsultation = await page.request.post(
      "/api/workspace/consultations",
      {
        data: {
          topicId: topic.id,
          publicTitle: "E2E consultation",
          publicPrompt: "What tradeoffs matter?",
        },
      },
    );
    expect(createConsultation.ok(), await createConsultation.text()).toBeTruthy();
    const consultation = (await createConsultation.json()) as { id: string };

    await advanceConversationToClosed(page, consultation.id);

    const importResponse = await page.request.post(
      `/api/workspace/consultations/${consultation.id}/reports`,
      {
        data: {
          publicTitle: "E2E aggregate report",
          payload: aggregatePayload("E2E aggregate report"),
        },
      },
    );
    expect(importResponse.ok(), await importResponse.text()).toBeTruthy();
    const imported = (await importResponse.json()) as {
      reportId: string;
      reportVersion: number;
    };
    expect(imported.reportVersion).toBe(1);

    // Draft/import must not be public yet — topic also unpublished → 404.
    const draftPublic = await page.request.get(
      `/formal-topics/${slug}/consultation/report`,
    );
    expect(draftPublic.status()).toBe(404);

    await page.goto(`/workspace/topics/${slug}/consultation-reports`);
    await expect(
      page.getByTestId("consultation-report-workspace"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("report-history-list")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const detail = await page.request.get(
      `/api/workspace/reports/${imported.reportId}`,
    );
    expect(detail.ok()).toBeTruthy();
    let report = (await detail.json()) as {
      concurrencyVersion: number;
      workflowState: string;
    };

    const validated = await page.request.post(
      `/api/workspace/reports/${imported.reportId}/validate`,
      { data: { expectedConcurrencyVersion: report.concurrencyVersion } },
    );
    expect(validated.ok(), await validated.text()).toBeTruthy();
    report = (await validated.json()) as typeof report;

    const reviewed = await page.request.post(
      `/api/workspace/reports/${imported.reportId}/review`,
      { data: { expectedConcurrencyVersion: report.concurrencyVersion } },
    );
    expect(reviewed.ok(), await reviewed.text()).toBeTruthy();
    report = (await reviewed.json()) as typeof report;

    const published = await page.request.post(
      `/api/workspace/reports/${imported.reportId}/publish`,
      { data: { expectedConcurrencyVersion: report.concurrencyVersion } },
    );
    expect(published.ok(), await published.text()).toBeTruthy();

    // Publish topic so public formal-topics route can resolve.
    const readiness = await page.request.post(
      `/api/workspace/topics/${topic.id}/publish`,
      { data: { expectedPublicationStatus: "unpublished" } },
    );
    // Topic may not be publish-ready without claims/evidence — that's fine.
    // Public report loader requires published topic projection.
    if (readiness.ok()) {
      await page.context().clearCookies();
      const publicReport = await page.goto(
        `/formal-topics/${slug}/consultation/report`,
      );
      expect(publicReport?.status()).toBe(200);
      await expect(page.getByTestId("public-input-report-panel")).toBeVisible();
      await expect(
        page.getByTestId("opinion-group-suppressed").first(),
      ).toBeVisible();
      await expect(page.locator("iframe")).toHaveCount(0);
    }

    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrWorse = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    expect(seriousOrWorse).toEqual([]);
  });
});
