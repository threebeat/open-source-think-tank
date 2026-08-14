import type { ReactNode } from "react";

import { PrototypeBanner } from "@/components/PrototypeBanner";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { resolveAppMode } from "@/lib/env/app-mode";
import { navForSession } from "@/lib/navigation";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  let authenticated = false;
  if (resolveAppMode() === "gated") {
    try {
      const { auth } = await import("@/lib/auth/next-auth");
      const session = await auth();
      authenticated = Boolean(
        (session?.user as { accountId?: string } | undefined)?.accountId,
      );
    } catch {
      authenticated = false;
    }
  }

  return (
    <div className="flex min-h-screen-safe flex-col">
      <div className="sticky top-0 z-40 bg-surface/95 pt-[var(--safe-top)] backdrop-blur supports-[backdrop-filter]:bg-surface/90">
        <PrototypeBanner />
        <SiteHeader items={navForSession(authenticated)} />
      </div>
      {children}
      <SiteFooter />
    </div>
  );
}
