import { createHmac, timingSafeEqual } from "node:crypto";

import {
  ENROLLMENT_MIN_FILL_MS,
  PRE_ALPHA_ASSIGNMENT_EXPLANATION,
} from "@/lib/auth/community-standards";
import {
  hashPassword,
  isEmailShapedIdentifier,
  normalizeIdentifier,
  validatePassword,
  verifyPassword,
} from "@/lib/auth/passwords";

export const PRE_ALPHA_ACCOUNTS_COOKIE = "ch_prealpha_accounts";
export const PRE_ALPHA_SESSION_COOKIE = "ch_prealpha_session";

const MAX_LOCAL_ACCOUNTS = 8;
const MAX_LOCAL_POSTS = 8;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type PreAlphaLocalPost = {
  publicId: string;
  title: string;
  body: string;
  category: "topic_proposals" | "approach_proposals" | "general_discussion";
  createdAt: string;
};

export type PreAlphaLocalAccount = {
  id: string;
  identifier: string;
  passwordHash: string;
  createdAt: string;
  displayName: string;
  posts: PreAlphaLocalPost[];
};

export type PreAlphaLocalSession = {
  accountId: string;
  identifier: string;
  sessionId: string;
  lifecycleState: "active";
  issuedAt: string;
};

function signingKey(): string {
  return (
    process.env.PRE_ALPHA_SESSION_KEY?.trim() ||
    "commonhall-pre-alpha-browser-auth-v1"
  );
}

function signPayload(payload: string): string {
  const digest = createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url");
  return `${payload}.${digest}`;
}

function verifySigned(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const lastDot = value.lastIndexOf(".");
  if (lastDot <= 0) {
    return null;
  }
  const payload = value.slice(0, lastDot);
  const digest = value.slice(lastDot + 1);
  const expected = createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url");
  const left = Buffer.from(digest);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  return payload;
}

function encodeJson(value: unknown): string {
  return signPayload(Buffer.from(JSON.stringify(value), "utf8").toString("base64url"));
}

function decodeJson<T>(value: string | null | undefined): T | null {
  const payload = verifySigned(value);
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function parseCookieHeader(
  header: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const name = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}

export function hasPreAlphaSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) {
    return false;
  }
  return new RegExp(
    `(?:^|;\\s*)${PRE_ALPHA_SESSION_COOKIE}=`,
  ).test(cookieHeader);
}

export function readLocalAccounts(
  cookieValue: string | null | undefined,
): PreAlphaLocalAccount[] {
  const parsed = decodeJson<PreAlphaLocalAccount[]>(cookieValue);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(
    (row) =>
      row &&
      typeof row.id === "string" &&
      typeof row.identifier === "string" &&
      typeof row.passwordHash === "string",
  );
}

export function readLocalSession(
  sessionCookie: string | null | undefined,
  accountsCookie: string | null | undefined,
): PreAlphaLocalSession | null {
  const session = decodeJson<PreAlphaLocalSession>(sessionCookie);
  if (!session?.accountId || !session.identifier || !session.sessionId) {
    return null;
  }
  const accounts = readLocalAccounts(accountsCookie);
  const match = accounts.find((row) => row.id === session.accountId);
  if (!match) {
    return null;
  }
  return session;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export function encodeAccountsCookie(accounts: PreAlphaLocalAccount[]): string {
  return encodeJson(accounts);
}

export function encodeSessionCookie(session: PreAlphaLocalSession): string {
  return encodeJson(session);
}

export async function readPreAlphaSessionFromStore(): Promise<PreAlphaLocalSession | null> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return readLocalSession(
    jar.get(PRE_ALPHA_SESSION_COOKIE)?.value,
    jar.get(PRE_ALPHA_ACCOUNTS_COOKIE)?.value,
  );
}

export async function readPreAlphaAccountFromStore(): Promise<PreAlphaLocalAccount | null> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const session = readLocalSession(
    jar.get(PRE_ALPHA_SESSION_COOKIE)?.value,
    jar.get(PRE_ALPHA_ACCOUNTS_COOKIE)?.value,
  );
  if (!session) {
    return null;
  }
  return (
    findLocalAccount(
      readLocalAccounts(jar.get(PRE_ALPHA_ACCOUNTS_COOKIE)?.value),
      session.identifier,
    ) ?? null
  );
}

export function findLocalAccount(
  accounts: PreAlphaLocalAccount[],
  identifier: string,
): PreAlphaLocalAccount | undefined {
  const normalized = normalizeIdentifier(identifier);
  return accounts.find((row) => row.identifier === normalized);
}

export type LocalEnrollInput = {
  identifier: string;
  password: string;
  honeypot?: string;
  formOpenedAt?: number;
  communityStandardsAssent: boolean;
};

export async function enrollLocalAccount(
  existing: PreAlphaLocalAccount[],
  input: LocalEnrollInput,
  now = new Date(),
): Promise<
  | {
      ok: true;
      accounts: PreAlphaLocalAccount[];
      session: PreAlphaLocalSession;
      assignmentExplanation: string;
    }
  | { ok: false; error: string; code: string }
> {
  if (input.honeypot?.trim()) {
    return {
      ok: false,
      error: "Enrollment could not be completed.",
      code: "ENROLLMENT_REJECTED",
    };
  }
  if (!input.communityStandardsAssent) {
    return {
      ok: false,
      error: "Community standards assent is required.",
      code: "ENROLLMENT_ASSENT_REQUIRED",
    };
  }
  const opened = Number(input.formOpenedAt);
  if (!Number.isFinite(opened) || now.getTime() - opened < ENROLLMENT_MIN_FILL_MS) {
    return {
      ok: false,
      error: "Please take a moment to finish the form.",
      code: "ENROLLMENT_TOO_FAST",
    };
  }
  const identifier = normalizeIdentifier(input.identifier);
  if (!isEmailShapedIdentifier(identifier)) {
    return {
      ok: false,
      error: "Use an email-shaped identifier.",
      code: "ENROLLMENT_IDENTIFIER",
    };
  }
  const passwordCheck = validatePassword(input.password, identifier);
  if (!passwordCheck.ok) {
    return passwordCheck;
  }
  if (findLocalAccount(existing, identifier)) {
    return {
      ok: false,
      error: "An account with that identifier already exists on this device.",
      code: "ENROLLMENT_DUPLICATE",
    };
  }
  if (existing.length >= MAX_LOCAL_ACCOUNTS) {
    return {
      ok: false,
      error: "This browser already holds the maximum number of pre-alpha accounts.",
      code: "ENROLLMENT_LIMIT",
    };
  }

  const account: PreAlphaLocalAccount = {
    id: `local-${crypto.randomUUID()}`,
    identifier,
    passwordHash: await hashPassword(input.password),
    createdAt: now.toISOString(),
    displayName: identifier.split("@")[0] || "Community member",
    posts: [],
  };
  const session: PreAlphaLocalSession = {
    accountId: account.id,
    identifier,
    sessionId: `lsess-${crypto.randomUUID()}`,
    lifecycleState: "active",
    issuedAt: now.toISOString(),
  };
  return {
    ok: true,
    accounts: [...existing, account],
    session,
    assignmentExplanation: PRE_ALPHA_ASSIGNMENT_EXPLANATION,
  };
}

export async function signInLocalAccount(
  existing: PreAlphaLocalAccount[],
  identifier: string,
  password: string,
  now = new Date(),
): Promise<
  | { ok: true; session: PreAlphaLocalSession }
  | { ok: false; error: string; code: string }
> {
  const account = findLocalAccount(existing, identifier);
  if (!account) {
    return {
      ok: false,
      error: "Identifier or password is incorrect.",
      code: "AUTH_PASSWORD_INVALID",
    };
  }
  const matches = await verifyPassword(password, account.passwordHash);
  if (!matches) {
    return {
      ok: false,
      error: "Identifier or password is incorrect.",
      code: "AUTH_PASSWORD_INVALID",
    };
  }
  return {
    ok: true,
    session: {
      accountId: account.id,
      identifier: account.identifier,
      sessionId: `lsess-${crypto.randomUUID()}`,
      lifecycleState: "active",
      issuedAt: now.toISOString(),
    },
  };
}

export function addLocalPost(
  accounts: PreAlphaLocalAccount[],
  accountId: string,
  input: { title: string; body: string; category: PreAlphaLocalPost["category"] },
  now = new Date(),
):
  | { ok: true; accounts: PreAlphaLocalAccount[]; post: PreAlphaLocalPost }
  | { ok: false; error: string; code: string } {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3 || title.length > 160) {
    return {
      ok: false,
      error: "Title must be between 3 and 160 characters.",
      code: "POST_TITLE",
    };
  }
  if (body.length < 3 || body.length > 400) {
    return {
      ok: false,
      error: "Body must be between 3 and 400 characters.",
      code: "POST_BODY",
    };
  }
  const index = accounts.findIndex((row) => row.id === accountId);
  if (index < 0) {
    return { ok: false, error: "Account not found.", code: "AUTH_REQUIRED" };
  }
  const account = accounts[index]!;
  if (account.posts.length >= MAX_LOCAL_POSTS) {
    return {
      ok: false,
      error: "This pre-alpha account already has the maximum number of posts.",
      code: "POST_LIMIT",
    };
  }
  const post: PreAlphaLocalPost = {
    publicId: `local-post-${crypto.randomUUID()}`,
    title,
    body,
    category: input.category,
    createdAt: now.toISOString(),
  };
  const next = accounts.slice();
  next[index] = { ...account, posts: [post, ...account.posts] };
  return { ok: true, accounts: next, post };
}
