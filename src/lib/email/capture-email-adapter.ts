import type { EmailAdapter, EmailMessage } from "@/lib/adapters/email";
import type { AdapterResult } from "@/lib/adapters/types";
import { newEntityId } from "@/lib/auth/tokens";

export type CapturedEmail = EmailMessage & { messageId: string; at: string };

/**
 * Local/test email sink for gated mode until a vendor ADR addendum lands.
 * Never use for production participant mail.
 */
export class CaptureEmailAdapter implements EmailAdapter {
  readonly name = "email" as const;
  readonly messages: CapturedEmail[] = [];

  async send(
    message: EmailMessage,
  ): Promise<AdapterResult<{ messageId: string }>> {
    const messageId = newEntityId("msg");
    this.messages.push({
      ...message,
      messageId,
      at: new Date().toISOString(),
    });
    return { ok: true, value: { messageId } };
  }

  lastTo(contactChannel: string): CapturedEmail | undefined {
    for (let i = this.messages.length - 1; i >= 0; i -= 1) {
      if (this.messages[i]?.to === contactChannel) {
        return this.messages[i];
      }
    }
    return undefined;
  }

  clear() {
    this.messages.length = 0;
  }
}

/** Process-wide capture sink used by gated local/test wiring. */
export const sharedCaptureEmail = new CaptureEmailAdapter();
