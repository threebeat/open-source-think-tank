import { NextResponse } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

/**
 * Synthetic E2E helper — enabled only when AUTH_E2E_CAPTURE=1 in gated mode.
 * Never enable against environments with real participant mail.
 */
export async function GET() {
  if (resolveAppMode() !== "gated" || process.env.AUTH_E2E_CAPTURE !== "1") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { sharedCaptureEmail } = await import(
    "@/lib/email/capture-email-adapter"
  );
  const last = sharedCaptureEmail.messages.at(-1);
  if (!last) {
    return NextResponse.json({ error: "No captured email" }, { status: 404 });
  }

  return NextResponse.json({
    to: last.to,
    subject: last.subject,
    textBody: last.textBody,
    messageId: last.messageId,
  });
}
