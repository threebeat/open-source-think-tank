import { NextResponse } from "next/server";

import {
  MUTATION_BODY_MAX_BYTES,
  mutationRateLimitedResponse,
  payloadTooLargeResponse,
  readBoundedJsonObject,
} from "@/lib/security/bounded-json";
import {
  getMutationRateLimiter,
  type MutationRateLimitFamily,
} from "@/lib/security/mutation-rate-limit";
import { resolveRequestOriginRef } from "@/lib/security/request-origin";

export type MutationGateSuccess = {
  ok: true;
  body: Record<string, unknown>;
};

export type MutationGateFailure = {
  ok: false;
  response: NextResponse;
};

/**
 * After CSRF + session: reject oversized declared bodies, consume the mutation
 * rate-limit buckets, then parse a bounded JSON object. Denied/oversized
 * requests never enter a domain transaction.
 */
export async function gateAuthenticatedMutation(input: {
  request: Request;
  accountId: string;
  family: MutationRateLimitFamily;
}): Promise<MutationGateSuccess | MutationGateFailure> {
  const declared = input.request.headers.get("content-length");
  if (declared != null && declared.trim() !== "") {
    const length = Number.parseInt(declared, 10);
    if (Number.isFinite(length) && length > MUTATION_BODY_MAX_BYTES) {
      return { ok: false, response: payloadTooLargeResponse() };
    }
  }

  const origin = resolveRequestOriginRef(input.request);
  const limited = getMutationRateLimiter().consume({
    family: input.family,
    accountId: input.accountId,
    originRef: origin.ok ? origin.originRef : null,
  });
  if (!limited.ok) {
    return {
      ok: false,
      response: mutationRateLimitedResponse(limited.retryAfterSeconds),
    };
  }

  const bodyResult = await readBoundedJsonObject(input.request);
  if (!bodyResult.ok) {
    return bodyResult;
  }

  return { ok: true, body: bodyResult.value };
}
