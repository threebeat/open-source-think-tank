import type { ReactNode } from "react";

import { PrototypeBanner } from "@/components/PrototypeBanner";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen-safe flex-col">
      <PrototypeBanner />
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
