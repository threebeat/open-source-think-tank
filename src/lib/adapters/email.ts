import type { AdapterResult } from "@/lib/adapters/types";

export type EmailMessage = {
  to: string;
  subject: string;
  textBody: string;
  /** Optional HTML; must not include verification artifacts or secrets beyond one-time links. */
  htmlBody?: string;
};

export interface EmailAdapter {
  readonly name: "email";
  send(message: EmailMessage): Promise<AdapterResult<{ messageId: string }>>;
}

export class NoopEmailAdapter implements EmailAdapter {
  readonly name = "email" as const;

  async send(
    _message: EmailMessage,
  ): Promise<AdapterResult<{ messageId: string }>> {
    return {
      ok: false,
      error: "Email delivery is not configured in this mode",
      code: "EMAIL_DISABLED",
    };
  }
}
