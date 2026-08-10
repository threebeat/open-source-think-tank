import type { AccountLifecycleState } from "@/lib/adapters/types";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    sessionId?: string;
    lifecycleState?: AccountLifecycleState;
    synthetic?: boolean;
    sessionToken?: string;
    accountId?: string;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      accountId: string;
      sessionId: string;
      lifecycleState: AccountLifecycleState;
      synthetic: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accountId?: string;
    sessionId?: string;
    lifecycleState?: AccountLifecycleState;
    synthetic?: boolean;
    /** Server-only; must not be exposed on client session. */
    sessionToken?: string;
  }
}
