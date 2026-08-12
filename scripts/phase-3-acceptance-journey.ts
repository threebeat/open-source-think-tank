/**
 * Connected Phase 3 acceptance-journey smoke (Phase 3 closure).
 *
 * Disposable PostgreSQL only (ostt_phase3_acceptance). Never ostt_dev.
 * Uses real domain services — not public-demo fixture mutations.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import * as schema from "../src/db/schema";
import { CaptureEmailAdapter } from "../src/lib/email/capture-email-adapter";
import { AuthService } from "../src/lib/auth/auth-service";
import { openDocumentPresentation } from "../src/lib/assent/presentation";
import { recordAssent } from "../src/lib/assent/record-assent";
import { reviewClaim } from "../src/lib/claims/review";
import {
  decideEvidenceQuality,
  reviewEvidenceWorkflow,
} from "../src/lib/evidence/review";
import { issueParticipantInvitation } from "../src/lib/invites/issue";
import { moderateClaim } from "../src/lib/moderation/service";
import { activateAccount } from "../src/lib/onboarding/activate";
import {
  computeDatabaseFingerprint,
  executeAlphaReset,
  parseDatabaseName,
} from "../src/lib/operator/alpha-reset";
import {
  finalizeAdministratorBootstrap,
  issueAdministratorBootstrapInvitation,
} from "../src/lib/operator/bootstrap";
import {
  OPERATIONAL_ASSENT_DOCUMENTS,
  OPERATIONAL_PRIVACY_DOCUMENT_ID,
} from "../src/lib/operator/operational-assent-documents";
import { requireOperatorResetEnv } from "../src/lib/operator/secrets";
import { getStaffClaimRevisionHistory } from "../src/lib/revisions/history";
import { createAndSubmitClaimEvidence } from "../src/lib/submissions/submit";
import { createTopic, transitionTopic } from "../src/lib/topics/authoring";
import { getPublishedTopicProjection } from "../src/lib/topics/gated-public-read";
import { projectionContainsForbiddenKeys } from "../src/lib/topics/public-projection";
import { publishTopic } from "../src/lib/topics/publish";
import { L3_KINDS } from "../src/lib/verification/assertion-kinds";
import {
  approveCase,
  assignReviewer,
  openVerificationCase,
} from "../src/lib/verification/cases";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const ADMIN_URL =
  process.env.OSTT_ADMIN_DATABASE_URL?.trim() ??
  "postgres://ostt:ostt@127.0.0.1:54329/postgres";
const JOURNEY_DB = "ostt_phase3_acceptance";
const JOURNEY_URL =
  process.env.OSTT_PHASE3_ACCEPTANCE_DATABASE_URL?.trim() ??
  `postgres://ostt:ostt@127.0.0.1:54329/${JOURNEY_DB}`;
const RESET_SECRET = "ostt-synth-operator-reset-secret-32chars!!!!";
const BOOTSTRAP_SECRET = "ostt-synth-operator-bootstrap-secret-32chars!!";

const PRIVATE_SENTINEL = "PHASE3_PRIVATE_SENTINEL_MUST_NOT_LEAK";
const ADMIN_CONTACT = "phase3-admin@ostt.acceptance.test";
const PARTICIPANT_CONTACT = "phase3-participant@ostt.acceptance.test";

function fail(message: string): never {
  console.error(`phase3:acceptance FAILED: ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function step(label: string) {
  console.log(`  ✓ ${label}`);
}

function extractToken(body: string): string {
  const match = body.match(/token=([^&\s]+)/);
  assert(match?.[1], "challenge token missing from capture email");
  return decodeURIComponent(match[1]!);
}

async function ensureDisposableDatabase(): Promise<void> {
  const admin = postgres(ADMIN_URL, { max: 1 });
  try {
    const rows = await admin`
      SELECT 1 AS ok FROM pg_database WHERE datname = ${JOURNEY_DB}
    `;
    if (rows.length === 0) {
      await admin.unsafe(`CREATE DATABASE ${JOURNEY_DB}`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

async function wipeSchema(client: postgres.Sql): Promise<void> {
  await client.unsafe(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    DROP SCHEMA IF EXISTS drizzle CASCADE;
  `);
}

async function assentPublishedDocuments(
  db: ReturnType<typeof drizzle>,
  accountId: string,
  method: string,
): Promise<void> {
  const docs = await db
    .select()
    .from(schema.documentVersions)
    .where(eq(schema.documentVersions.state, "published"));
  assert(docs.length > 0, "no published operational documents");
  for (const doc of docs) {
    const presented = await openDocumentPresentation(db, {
      accountId,
      documentVersionId: doc.id,
    });
    assert(presented.ok, presented.ok ? "" : presented.error);
    const assented = await recordAssent(db, {
      accountId,
      documentVersionId: doc.id,
      presentationId: presented.value.presentationId,
      noticesAcknowledged: [...doc.requiredNotices],
      method,
    });
    assert(assented.ok, assented.ok ? "" : assented.error);
  }
}

async function openRequiredVerification(
  db: ReturnType<typeof drizzle>,
  accountId: string,
): Promise<string[]> {
  const caseIds: string[] = [];
  for (const kind of [...L3_KINDS, "eligibility"] as const) {
    const opened = await openVerificationCase(db, {
      accountId,
      kind,
      assertionSummary: `Phase 3 acceptance assertion for ${kind}`,
      actorAccountId: accountId,
    });
    assert(opened.ok, opened.ok ? kind : opened.error);
    caseIds.push(opened.value.caseId);
  }
  return caseIds;
}

async function main() {
  console.log("Phase 3 acceptance journey — disposable DB only.");
  execSync("npm run db:up", { stdio: "inherit" });
  await ensureDisposableDatabase();

  assert(parseDatabaseName(JOURNEY_URL) === JOURNEY_DB, "wrong DB name");
  assert(parseDatabaseName(JOURNEY_URL) !== "ostt_dev", "must not use ostt_dev");

  process.env.APP_MODE = "gated";
  process.env.DATABASE_URL = JOURNEY_URL;
  process.env.OPERATOR_RESET_SECRET = RESET_SECRET;
  process.env.OPERATOR_BOOTSTRAP_SECRET = BOOTSTRAP_SECRET;
  process.env.OPERATOR_LABEL = "ostt-phase3-acceptance";
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET ?? "ostt-synth-auth-secret-phase3-acceptance";
  process.env.SOURCE_COMMIT_SHA = execSync("git rev-parse HEAD", {
    encoding: "utf8",
  }).trim();
  delete process.env.OSTT_ALLOW_DEV_RESET;

  const client = postgres(JOURNEY_URL, { max: 4 });
  const db = drizzle(client, { schema });

  try {
    await wipeSchema(client);
    await migrate(db, { migrationsFolder: path.join(root, "drizzle") });

    // 1) Start from post-reset operational configuration (no synthetic seed).
    const fingerprint = computeDatabaseFingerprint(JOURNEY_URL);
    const initialReset = await executeAlphaReset(db, {
      reason: "Phase 3 acceptance initial post-reset configuration",
      confirmFingerprint: fingerprint,
      syntheticReceipt: false,
    });
    assert(initialReset.ok, initialReset.ok ? "" : initialReset.error);
    assert(
      initialReset.value.receiptProvenance === "operational",
      "acceptance reset must be operational",
    );
    const publishedDocs = await db
      .select()
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.state, "published"));
    assert(
      publishedDocs.length === OPERATIONAL_ASSENT_DOCUMENTS.length,
      "operational docs missing after reset",
    );
    assert(
      publishedDocs.some((row) => row.id === OPERATIONAL_PRIVACY_DOCUMENT_ID),
      "ops privacy doc missing",
    );
    step("1. Post-reset operational configuration");

    // 2) Bootstrap first administrator.
    const issuedAdmin = await issueAdministratorBootstrapInvitation(db, {
      intendedContactChannel: ADMIN_CONTACT,
      reason: "Phase 3 acceptance first-administrator bootstrap.",
    });
    assert(issuedAdmin.ok, issuedAdmin.ok ? "" : issuedAdmin.error);
    const email = new CaptureEmailAdapter();
    const auth = new AuthService({
      db,
      email,
      appUrl: "http://127.0.0.1:3000",
    });
    const adminAccepted = await auth.acceptInvite({
      inviteToken: issuedAdmin.value.rawToken,
      contactChannel: ADMIN_CONTACT,
    });
    assert(adminAccepted.ok, adminAccepted.ok ? "" : adminAccepted.error);
    const adminMail = email.lastTo(ADMIN_CONTACT);
    assert(adminMail?.textBody, "admin capture email missing");
    const adminSession = await auth.completeChallenge(
      extractToken(adminMail.textBody),
    );
    assert(adminSession.ok, adminSession.ok ? "" : adminSession.error);
    const adminId = adminSession.value.accountId;
    await assentPublishedDocuments(db, adminId, "phase3-acceptance-admin");
    await openRequiredVerification(db, adminId);
    const finalized = await finalizeAdministratorBootstrap(db, {
      reason: "Complete Phase 3 acceptance first administrator.",
      verificationReason:
        "Owner-run alpha operator_bootstrap attestation for acceptance journey.",
    });
    assert(finalized.ok, finalized.ok ? "" : finalized.error);
    assert(finalized.value.accountId === adminId, "admin finalize mismatch");
    step("2. Bootstrap first administrator");

    // 3–4) Issue/accept participant invitation; assent, verification, activation.
    const issuedParticipant = await issueParticipantInvitation(db, {
      actorAccountId: adminId,
      intendedContactChannel: PARTICIPANT_CONTACT,
    });
    assert(
      issuedParticipant.ok,
      issuedParticipant.ok ? "" : issuedParticipant.error,
    );
    email.clear();
    const participantAccepted = await auth.acceptInvite({
      inviteToken: issuedParticipant.value.rawToken,
      contactChannel: PARTICIPANT_CONTACT,
    });
    assert(
      participantAccepted.ok,
      participantAccepted.ok ? "" : participantAccepted.error,
    );
    const participantMail = email.lastTo(PARTICIPANT_CONTACT);
    assert(participantMail?.textBody, "participant capture email missing");
    const participantSession = await auth.completeChallenge(
      extractToken(participantMail.textBody),
    );
    assert(
      participantSession.ok,
      participantSession.ok ? "" : participantSession.error,
    );
    const participantId = participantSession.value.accountId;
    await assentPublishedDocuments(
      db,
      participantId,
      "phase3-acceptance-participant",
    );
    const caseIds = await openRequiredVerification(db, participantId);
    for (const caseId of caseIds) {
      const assigned = await assignReviewer(db, {
        caseId,
        reviewerAccountId: adminId,
        actorAccountId: adminId,
      });
      assert(assigned.ok, assigned.ok ? "" : assigned.error);
      const approved = await approveCase(db, {
        caseId,
        actorAccountId: adminId,
        reason: "Phase 3 acceptance staff verification approval.",
      });
      assert(approved.ok, approved.ok ? "" : approved.error);
    }
    const activated = await activateAccount(db, { accountId: participantId });
    assert(activated.ok, activated.ok ? "" : activated.error);
    step("3–4. Participant invite, assent, verification, activation");

    // 5) Create and open topic.
    const topic = await createTopic(db, {
      actorAccountId: adminId,
      slug: "phase3-acceptance-cedar-ops",
      title: "Phase 3 acceptance Cedar operations topic",
      question: "Should the acceptance drill publish a clearer operations brief?",
      background: "Acceptance-journey background only — synthetic drill text.",
      scope: "Disposable Phase 3 acceptance scope.",
      jurisdictionLevel: "statewide",
      stateCode: "TN",
    });
    assert(topic.ok, topic.ok ? "" : topic.error);
    const opened = await transitionTopic(db, {
      actorAccountId: adminId,
      topicId: topic.value.id,
      action: "open",
      expectedWorkflowState: "draft",
    });
    assert(opened.ok, opened.ok ? "" : opened.error);
    step("5. Create and open topic");

    // 6) Submit claim + evidence with relationship, limitations, disclosure.
    const submitted = await createAndSubmitClaimEvidence(db, {
      actorAccountId: participantId,
      topicId: topic.value.id,
      claimTitle: "Acceptance claim: clearer ops timeline",
      claimSummary: "A clearer timeline reduces confusion in the acceptance drill.",
      approachLabel: "Operational transparency",
      sourceUrl: "https://example.ostt.acceptance.test/ops-memo",
      evidenceTitle: "Acceptance ops memo",
      organization: "Acceptance Research Desk",
      authorType: "agency",
      sourceType: "memo",
      limitations: "Acceptance-journey metadata only — no remote fetch.",
      relationship: "supporting",
      disclosureChoice: "disclose",
      disclosurePublicSummary:
        "Acceptance participant discloses a fictional prior advisory role.",
      disclosurePrivateDetail: PRIVATE_SENTINEL,
    });
    assert(submitted.ok, submitted.ok ? "" : submitted.error);

    const counter = await createAndSubmitClaimEvidence(db, {
      actorAccountId: participantId,
      topicId: topic.value.id,
      claimTitle: "Acceptance claim: timeline may increase load",
      claimSummary: "Counter view for relationship comparison in acceptance.",
      approachLabel: "Capacity caution",
      sourceUrl: "https://example.ostt.acceptance.test/ops-counter",
      evidenceTitle: "Acceptance ops counter brief",
      organization: "Acceptance Alternate Desk",
      authorType: "researcher",
      sourceType: "report",
      limitations: "Counterevidence acceptance metadata only.",
      relationship: "counterevidence",
      disclosureChoice: "none",
    });
    assert(counter.ok, counter.ok ? "" : counter.error);
    step("6. Submit claim/evidence with relationship, limitations, disclosure");

    // 7) Reviewer workflow + quality independent of popularity/consensus.
    const claimReview = await reviewClaim(db, {
      actorAccountId: adminId,
      claimId: submitted.value.claim.id,
      decision: "accepted",
      publicRationale:
        "Acceptance claim workflow accepted for publish readiness.",
      privateNotes: PRIVATE_SENTINEL,
      expectedWorkflowState: "submitted",
    });
    assert(claimReview.ok, claimReview.ok ? "" : claimReview.error);

    const evidenceWorkflow = await reviewEvidenceWorkflow(db, {
      actorAccountId: adminId,
      evidenceSubmissionId: submitted.value.evidence.id,
      decision: "accepted",
      publicRationale: "Acceptance evidence workflow accepted.",
      privateNotes: PRIVATE_SENTINEL,
      expectedWorkflowState: "submitted",
    });
    assert(evidenceWorkflow.ok, evidenceWorkflow.ok ? "" : evidenceWorkflow.error);

    const quality = await decideEvidenceQuality(db, {
      actorAccountId: adminId,
      evidenceSubmissionId: submitted.value.evidence.id,
      qualityStatus: "limited",
      publicRationale:
        "Quality labeled limited; independent of workflow acceptance and any popularity/consensus signal.",
      privateNotes: PRIVATE_SENTINEL,
      expectedQualityStatus: "pending",
    });
    assert(quality.ok, quality.ok ? "" : quality.error);
    assert(
      quality.value.evidence.qualityStatus === "limited",
      "quality must remain independent label",
    );
    assert(
      quality.value.evidence.workflowState === "accepted",
      "workflow acceptance must not be overwritten by quality",
    );

    // Accept the counterevidence path as well for publishable linked evidence.
    const counterClaimReview = await reviewClaim(db, {
      actorAccountId: adminId,
      claimId: counter.value.claim.id,
      decision: "accepted",
      publicRationale: "Acceptance counter claim workflow accepted.",
      expectedWorkflowState: "submitted",
    });
    assert(
      counterClaimReview.ok,
      counterClaimReview.ok ? "" : counterClaimReview.error,
    );
    const counterEvidenceWorkflow = await reviewEvidenceWorkflow(db, {
      actorAccountId: adminId,
      evidenceSubmissionId: counter.value.evidence.id,
      decision: "accepted",
      publicRationale: "Acceptance counter evidence workflow accepted.",
      expectedWorkflowState: "submitted",
    });
    assert(
      counterEvidenceWorkflow.ok,
      counterEvidenceWorkflow.ok ? "" : counterEvidenceWorkflow.error,
    );
    const counterQuality = await decideEvidenceQuality(db, {
      actorAccountId: adminId,
      evidenceSubmissionId: counter.value.evidence.id,
      qualityStatus: "accepted",
      publicRationale: "Counterevidence quality accepted independently.",
      expectedQualityStatus: "pending",
    });
    assert(counterQuality.ok, counterQuality.ok ? "" : counterQuality.error);
    step("7. Reviewer workflow and independent evidence-quality decisions");

    // 8) Moderation visibility action without deleting history.
    const [claimRow] = await db
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, submitted.value.claim.id))
      .limit(1);
    assert(claimRow, "claim missing before moderation");
    const held = await moderateClaim(db, {
      actorAccountId: adminId,
      claimId: claimRow.id,
      action: "hold",
      publicRationale: "Acceptance hold for reasoned visibility drill.",
      privateNotes: PRIVATE_SENTINEL,
      expectedVisibility: "visible",
      expectedUpdatedAt: claimRow.updatedAt,
    });
    assert(held.ok, held.ok ? "" : held.error);
    const [heldRow] = await db
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, claimRow.id))
      .limit(1);
    assert(heldRow, "claim missing after hold");
    const restored = await moderateClaim(db, {
      actorAccountId: adminId,
      claimId: heldRow.id,
      action: "restore",
      publicRationale: "Acceptance restore after hold; history retained.",
      privateNotes: PRIVATE_SENTINEL,
      expectedVisibility: "held",
      expectedUpdatedAt: heldRow.updatedAt,
    });
    assert(restored.ok, restored.ok ? "" : restored.error);
    const modActions = await db
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.claimId, claimRow.id));
    assert(modActions.length >= 2, "moderation history must be retained");
    step("8. Moderation visibility without deleting history");

    // 9) Publish topic (workflow must be under_review).
    const beginReview = await transitionTopic(db, {
      actorAccountId: adminId,
      topicId: topic.value.id,
      action: "begin_review",
      expectedWorkflowState: "open_for_submissions",
      reason: "Begin review for Phase 3 acceptance publication.",
    });
    assert(beginReview.ok, beginReview.ok ? "" : beginReview.error);
    const published = await publishTopic(db, {
      actorAccountId: adminId,
      topicId: topic.value.id,
      expectedPublicationStatus: "unpublished",
    });
    assert(published.ok, published.ok ? "" : published.error);
    step("9. Publish topic");

    // 10) Anonymous projection allowlist / private sentinel exclusion.
    const projection = await getPublishedTopicProjection(
      db,
      "phase3-acceptance-cedar-ops",
    );
    assert(projection.ok, projection.ok ? "" : projection.error);
    assert(projection.value, "published projection missing");
    const leaks = projectionContainsForbiddenKeys(projection.value);
    assert(leaks.length === 0, `projection leaked keys: ${leaks.join(", ")}`);
    const serialized = JSON.stringify(projection.value);
    assert(
      !serialized.includes(PRIVATE_SENTINEL),
      "private sentinel leaked into public projection",
    );
    assert(
      !serialized.includes(PARTICIPANT_CONTACT),
      "participant contact leaked into public projection",
    );
    step("10. Anonymous projection allowlist verified");

    // 11) Revision/audit evidence without prohibited private content.
    const staffHistory = await getStaffClaimRevisionHistory(db, {
      actorAccountId: adminId,
      claimId: submitted.value.claim.id,
    });
    // May be empty if no content revisions were recorded — still prove audit trail.
    assert(staffHistory.ok, staffHistory.ok ? "" : staffHistory.error);
    const audits = await db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.action, "topics.published"));
    assert(audits.length >= 1, "publish audit missing");
    for (const row of audits) {
      const payload = JSON.stringify(row.privatePayload ?? {});
      assert(
        !payload.includes(PRIVATE_SENTINEL),
        "private sentinel in audit payload",
      );
      assert(
        !payload.includes(PARTICIPANT_CONTACT),
        "contact channel in audit payload",
      );
    }
    step("11. Revision/audit evidence without prohibited private content");

    // 12–14) Operator reset; wipe alpha data; retained/regenerated config + bootstrap ready.
    const postJourneyReset = await executeAlphaReset(db, {
      reason: "Phase 3 acceptance operator reset after journey",
      confirmFingerprint: fingerprint,
      syntheticReceipt: false,
    });
    assert(postJourneyReset.ok, postJourneyReset.ok ? "" : postJourneyReset.error);
    step("12. Operator reset executed");

    const accountsAfter = await db.select().from(schema.accounts);
    const topicsAfter = await db.select().from(schema.topics);
    const claimsAfter = await db.select().from(schema.claims);
    const evidenceAfter = await db.select().from(schema.evidenceSubmissions);
    const disclosuresAfter = await db.select().from(schema.conflictDisclosures);
    const moderationAfter = await db.select().from(schema.moderationActions);
    const revisionsAfter = await db.select().from(schema.contentRevisions);
    const assentAfter = await db.select().from(schema.assentRecords);
    const invitesAfter = await db.select().from(schema.invitations);
    const sessionsAfter = await db.select().from(schema.authSessions);
    assert(accountsAfter.length === 0, "accounts remain after reset");
    assert(topicsAfter.length === 0, "topics remain after reset");
    assert(claimsAfter.length === 0, "claims remain after reset");
    assert(evidenceAfter.length === 0, "evidence remain after reset");
    assert(disclosuresAfter.length === 0, "disclosures remain after reset");
    assert(moderationAfter.length === 0, "moderation remain after reset");
    assert(revisionsAfter.length === 0, "revisions remain after reset");
    assert(assentAfter.length === 0, "assent records remain after reset");
    assert(invitesAfter.length === 0, "invitations remain after reset");
    assert(sessionsAfter.length === 0, "sessions remain after reset");
    step("13. Alpha accounts/workflow/assent/audit participant data wiped");

    const docsAfter = await db
      .select()
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.state, "published"));
    assert(
      docsAfter.some((row) => row.id === OPERATIONAL_PRIVACY_DOCUMENT_ID),
      "operational docs not regenerated",
    );
    const retention = await db.select().from(schema.retentionPolicySettings);
    assert(retention.length >= 1, "retention defaults missing");
    const [bootstrap] = await db
      .select()
      .from(schema.operatorBootstrapState)
      .where(eq(schema.operatorBootstrapState.id, "default"))
      .limit(1);
    assert(bootstrap?.status === "not_started", "bootstrap not ready");
    const receipts = await db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.action, "alpha.reset_executed"));
    assert(receipts.length === 1, "expected single reset receipt root");
    assert(receipts[0]?.synthetic === false, "operational receipt must be non-synthetic");

    const reissue = await issueAdministratorBootstrapInvitation(db, {
      intendedContactChannel: "phase3-recovery@ostt.acceptance.test",
      reason: "Prove bootstrap can begin after acceptance reset.",
    });
    assert(reissue.ok, reissue.ok ? "" : reissue.error);
    step("14. Retained/regenerated ops config; new bootstrap can begin");

    // 15) Public-demo isolation — zero gated reset construction.
    const demoReset = requireOperatorResetEnv({
      APP_MODE: "public-demo",
      OPERATOR_RESET_SECRET: RESET_SECRET,
      OPERATOR_LABEL: "x",
      DATABASE_URL: JOURNEY_URL,
    });
    assert(!demoReset.ok, "public-demo must refuse reset env");
    if (!demoReset.ok) {
      assert(
        ["PUBLIC_DEMO_NO_RESET", "ENV_UNSAFE"].includes(demoReset.code ?? ""),
        "unexpected public-demo reset code",
      );
    }
    // Ensure we did not point env at ostt_dev and DB name stayed disposable.
    assert(parseDatabaseName(process.env.DATABASE_URL!) === JOURNEY_DB, "env drifted");
    step("15. Public-demo isolation / zero gated reset construction");

    console.log("phase3:acceptance OK");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
