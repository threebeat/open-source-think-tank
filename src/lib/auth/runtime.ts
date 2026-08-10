import { createPostgresDb } from "@/db/client";
import type { FoundationDb } from "@/db/types";
import type { EmailAdapter } from "@/lib/adapters/email";
import { AuthService } from "@/lib/auth/auth-service";
import { resolveAppMode } from "@/lib/env/app-mode";
import { sharedCaptureEmail } from "@/lib/email/capture-email-adapter";

let cached:
  | {
      db: FoundationDb;
      client: { end: (options?: { timeout?: number }) => Promise<void> };
      service: AuthService;
    }
  | undefined;

export function assertGatedAuthRuntime() {
  const mode = resolveAppMode(process.env);
  if (mode !== "gated") {
    throw new Error("Auth runtime is only available when APP_MODE=gated");
  }
  if (!process.env.AUTH_SECRET?.trim()) {
    throw new Error("APP_MODE=gated auth runtime requires AUTH_SECRET");
  }
}

export function getEmailAdapter(): EmailAdapter {
  return sharedCaptureEmail;
}

export function getAuthService(): AuthService {
  assertGatedAuthRuntime();
  if (!cached) {
    const { db, client } = createPostgresDb();
    const appUrl =
      process.env.AUTH_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      "http://127.0.0.1:3000";
    cached = {
      db,
      client,
      service: new AuthService({
        db,
        email: getEmailAdapter(),
        appUrl,
      }),
    };
  }
  return cached.service;
}

export function getGatedDb(): FoundationDb {
  assertGatedAuthRuntime();
  if (!cached) {
    getAuthService();
  }
  return cached!.db;
}
