import { NextResponse } from "next/server";

/** Shared 32 KiB cap for gated mutation JSON bodies. */
export const MUTATION_BODY_MAX_BYTES = 32 * 1024;

export type BoundedJsonSuccess = {
  ok: true;
  value: Record<string, unknown>;
};

export type BoundedJsonFailure = {
  ok: false;
  response: NextResponse;
};

export type BoundedJsonResult = BoundedJsonSuccess | BoundedJsonFailure;

function noStoreJson(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

/**
 * Read a JSON object body with a hard byte cap before Zod/domain work.
 * Rejects oversized declared Content-Length and streamed bodies above the cap.
 */
export async function readBoundedJsonObject(
  request: Request,
  maxBytes = MUTATION_BODY_MAX_BYTES,
): Promise<BoundedJsonResult> {
  const declared = request.headers.get("content-length");
  if (declared != null && declared.trim() !== "") {
    const length = Number.parseInt(declared, 10);
    if (Number.isFinite(length) && length > maxBytes) {
      return {
        ok: false,
        response: noStoreJson(
          {
            error: "Request body is too large.",
            code: "PAYLOAD_TOO_LARGE",
          },
          413,
        ),
      };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    // No stream — fall back to arrayBuffer with a size check.
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      return {
        ok: false,
        response: noStoreJson(
          {
            error: "Request body is too large.",
            code: "PAYLOAD_TOO_LARGE",
          },
          413,
        ),
      };
    }
    return parseObject(buffer);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore cancel errors
      }
      return {
        ok: false,
        response: noStoreJson(
          {
            error: "Request body is too large.",
            code: "PAYLOAD_TOO_LARGE",
          },
          413,
        ),
      };
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return parseObject(merged.buffer);
}

function parseObject(buffer: ArrayBuffer): BoundedJsonResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return {
      ok: false,
      response: noStoreJson(
        { error: "Invalid JSON body", code: "INVALID_JSON" },
        400,
      ),
    };
  }

  if (text.trim() === "") {
    return {
      ok: false,
      response: noStoreJson(
        { error: "Invalid JSON body", code: "INVALID_JSON" },
        400,
      ),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      response: noStoreJson(
        { error: "Invalid JSON body", code: "INVALID_JSON" },
        400,
      ),
    };
  }

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return {
      ok: false,
      response: noStoreJson(
        { error: "Invalid JSON body", code: "INVALID_JSON" },
        400,
      ),
    };
  }

  return { ok: true, value: parsed as Record<string, unknown> };
}

/** Consistent 429 response for mutation abuse controls. */
export function mutationRateLimitedResponse(retryAfterSeconds: number): NextResponse {
  const retry = Math.max(1, Math.ceil(retryAfterSeconds));
  return noStoreJson(
    {
      error: "Too many attempts. Try again later.",
      code: "MUTATION_RATE_LIMITED",
      retryAfterSeconds: retry,
    },
    429,
    { "Retry-After": String(retry) },
  );
}

/** Consistent 413 helper when a caller already measured size outside the reader. */
export function payloadTooLargeResponse(): NextResponse {
  return noStoreJson(
    {
      error: "Request body is too large.",
      code: "PAYLOAD_TOO_LARGE",
    },
    413,
  );
}
