import type { ReactNode } from "react";

import { PrototypeBanner } from "@/components/PrototypeBanner";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DemoPresentationBar } from "@/features/demo/DemoPresentationBar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen-safe flex-col">
      <div className="sticky top-0 z-40 bg-surface/95 pt-[var(--safe-top)] backdrop-blur supports-[backdrop-filter]:bg-surface/90">
        <PrototypeBanner />
        <SiteHeader />
        <DemoPresentationBar />
      </div>
      {children}
      <SiteFooter />
    </div>
  );
}
