import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getAuthService } from "@/lib/auth/runtime";

/**
 * Auth.js (NextAuth v5) session bridge for gated mode.
 * Domain logic lives in AuthService; this module only establishes cookies/JWT.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // Placeholder allows public-demo production builds; runtime handlers 404 unless gated.
  secret: process.env.AUTH_SECRET ?? "public-demo-build-placeholder",
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/error",
  },
  providers: [
    Credentials({
      id: "session-token",
      name: "Session token",
      credentials: {
        sessionToken: { label: "Session token", type: "text" },
      },
      authorize: async (credentials) => {
        const sessionToken = credentials?.sessionToken;
        if (typeof sessionToken !== "string" || !sessionToken) {
          return null;
        }
        const service = getAuthService();
        const session = await service.getSessionByToken(sessionToken);
        if (!session.ok || !session.value) {
          return null;
        }
        return {
          id: session.value.accountId,
          sessionId: session.value.sessionId,
          lifecycleState: session.value.lifecycleState,
          synthetic: session.value.synthetic,
          sessionToken,
        };
      },
    }),
    Credentials({
      id: "password",
      name: "Password",
      credentials: {
        identifier: { label: "Identifier", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const identifier = credentials?.identifier;
        const password = credentials?.password;
        if (typeof identifier !== "string" || typeof password !== "string") {
          return null;
        }
        const service = getAuthService();
        const session = await service.signInWithPassword(identifier, password);
        if (!session.ok) {
          return null;
        }
        return {
          id: session.value.accountId,
          sessionId: session.value.sessionId,
          lifecycleState: session.value.lifecycleState,
          synthetic: session.value.synthetic,
          sessionToken: session.value.rawSessionToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accountId = user.id;
        token.sessionId = (user as { sessionId?: string }).sessionId;
        token.lifecycleState = (
          user as { lifecycleState?: string }
        ).lifecycleState;
        token.synthetic = (user as { synthetic?: boolean }).synthetic;
        token.sessionToken = (user as { sessionToken?: string }).sessionToken;
      }

      const sessionToken = token.sessionToken;
      if (typeof sessionToken !== "string") {
        return { ...token, accountId: undefined };
      }

      try {
        const service = getAuthService();
        const current = await service.getSessionByToken(sessionToken);
        if (!current.ok || !current.value) {
          return { ...token, accountId: undefined, sessionToken: undefined };
        }
        token.accountId = current.value.accountId;
        token.sessionId = current.value.sessionId;
        token.lifecycleState = current.value.lifecycleState;
        token.synthetic = current.value.synthetic;
      } catch {
        return { ...token, accountId: undefined, sessionToken: undefined };
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.accountId || !token.sessionId || !token.lifecycleState) {
        return { ...session, user: undefined as never };
      }
      return {
        ...session,
        user: {
          ...session.user,
          id: String(token.accountId),
          accountId: String(token.accountId),
          sessionId: String(token.sessionId),
          lifecycleState: token.lifecycleState as
            | "invited"
            | "pending_onboarding"
            | "active"
            | "suspended"
            | "closed"
            | "anonymization-pending",
          synthetic: Boolean(token.synthetic),
        },
      };
    },
  },
});
