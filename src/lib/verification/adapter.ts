import type { FoundationDb } from "@/db/types";
import type { AdapterResult } from "@/lib/adapters/types";
import type {
  VerificationAdapter,
  VerificationAssertionKind,
  VerificationCaseStatus,
} from "@/lib/adapters/verification";
import { getKindStatus } from "@/lib/verification/status";

/** Local/manual reviewer workflow — no identity vendor (register still blocked). */
export class LocalManualVerificationAdapter implements VerificationAdapter {
  readonly name = "verification" as const;

  constructor(private readonly db: FoundationDb) {}

  async getStatus(
    accountId: string,
    kind: VerificationAssertionKind,
  ): Promise<AdapterResult<VerificationCaseStatus | "none">> {
    const status = await getKindStatus(this.db, accountId, kind);
    return { ok: true, value: status };
  }
}
