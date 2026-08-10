import { and, eq, isNull } from "drizzle-orm";

import {
  verificationArtifactHolds,
  verificationArtifactPayloads,
  verificationAssertions,
} from "@/db/schema";
import type { FoundationDb } from "@/db/types";
import type { AuthAuditDb } from "@/lib/auth/audit-log";
import type { AdapterResult } from "@/lib/adapters/types";

const HOLD_POINTER_RE = /^ostt:vhold:([A-Za-z0-9_-]+)$/;
const PURGED_POINTER_RE = /^ostt:purged:([A-Za-z0-9_-]+)$/;

const FORBIDDEN_SUMMARY =
  /(https?:\/\/|www\.|data:|Bearer\s+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]+|[A-Za-z0-9+/]{80,}={0,2})/i;

const FORBIDDEN_POINTER_INPUT =
  /(https?:\/\/|www\.|data:|Bearer\s+|eyJ[A-Za-z0-9_-]+\.|[A-Za-z0-9+/]{40,}={0,2}|ostt:)/i;

export function formatHoldPointer(holdId: string): string {
  return `ostt:vhold:${holdId}`;
}

export function formatPurgedPointer(holdId: string): string {
  return `ostt:purged:${holdId}`;
}

export function parseHoldPointer(pointer: string): string | null {
  const match = HOLD_POINTER_RE.exec(pointer.trim());
  return match?.[1] ?? null;
}

export function validateAssertionSummary(
  summary: string,
): AdapterResult<string> {
  const trimmed = summary.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Assertion summary is required.",
      code: "VERIFY_SUMMARY_REQUIRED",
    };
  }
  if (trimmed.length > 500) {
    return {
      ok: false,
      error: "Assertion summary exceeds 500 characters.",
      code: "VERIFY_SUMMARY_INVALID",
    };
  }
  if (FORBIDDEN_SUMMARY.test(trimmed)) {
    return {
      ok: false,
      error:
        "Assertion summary must not contain URLs, tokens, or raw payload material.",
      code: "VERIFY_SUMMARY_INVALID",
    };
  }
  return { ok: true, value: trimmed };
}

/** Reject client-supplied pointer strings; server mints ostt:vhold:… only. */
export function rejectClientEvidencePointer(
  pointer: string | null | undefined,
): AdapterResult<true> {
  if (pointer == null || pointer === "") {
    return { ok: true, value: true };
  }
  return {
    ok: false,
    error:
      "Client-supplied evidence pointers are not accepted. Use the server artifact retention path.",
    code: "VERIFY_POINTER_FORBIDDEN",
  };
}

export function looksLikeForbiddenPointerMaterial(value: string): boolean {
  return FORBIDDEN_POINTER_INPUT.test(value);
}

/**
 * Resolve a live artifact payload for an approved hold pointer.
 * Returns unavailable after expiry, purge, or tombstone.
 */
export async function resolveArtifactAccess(
  db: FoundationDb | AuthAuditDb,
  pointer: string,
  now = new Date(),
): Promise<
  AdapterResult<{ holdId: string; purpose: string; payload: string }>
> {
  if (PURGED_POINTER_RE.test(pointer.trim())) {
    return {
      ok: false,
      error: "Artifact pointer has been purged.",
      code: "VERIFY_ARTIFACT_PURGED",
    };
  }

  const holdId = parseHoldPointer(pointer);
  if (!holdId) {
    return {
      ok: false,
      error: "Evidence pointer must use the ostt:vhold:<id> scheme.",
      code: "VERIFY_POINTER_INVALID",
    };
  }

  const [hold] = await db
    .select()
    .from(verificationArtifactHolds)
    .where(eq(verificationArtifactHolds.id, holdId))
    .limit(1);
  if (!hold) {
    return {
      ok: false,
      error: "Artifact hold not found.",
      code: "VERIFY_ARTIFACT_MISSING",
    };
  }
  if (hold.purgedAt || hold.expiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      error: "Artifact hold expired or purged.",
      code: "VERIFY_ARTIFACT_UNAVAILABLE",
    };
  }

  const [payloadRow] = await db
    .select()
    .from(verificationArtifactPayloads)
    .where(
      and(
        eq(verificationArtifactPayloads.holdId, holdId),
        isNull(verificationArtifactPayloads.deletedAt),
      ),
    )
    .limit(1);
  if (!payloadRow?.payload) {
    return {
      ok: false,
      error: "Artifact payload unavailable.",
      code: "VERIFY_ARTIFACT_UNAVAILABLE",
    };
  }

  return {
    ok: true,
    value: {
      holdId,
      purpose: hold.purpose,
      payload: payloadRow.payload,
    },
  };
}

/** Clear payload, mark hold purged, tombstone assertion pointer. */
export async function revokeArtifactForHold(
  db: FoundationDb | AuthAuditDb,
  holdId: string,
  now = new Date(),
): Promise<void> {
  await db
    .update(verificationArtifactPayloads)
    .set({ payload: null, deletedAt: now })
    .where(eq(verificationArtifactPayloads.holdId, holdId));

  const [hold] = await db
    .update(verificationArtifactHolds)
    .set({ purgedAt: now })
    .where(
      and(
        eq(verificationArtifactHolds.id, holdId),
        isNull(verificationArtifactHolds.purgedAt),
      ),
    )
    .returning();

  if (hold?.assertionId) {
    await db
      .update(verificationAssertions)
      .set({ evidencePointer: formatPurgedPointer(holdId) })
      .where(eq(verificationAssertions.id, hold.assertionId));
  }
}
