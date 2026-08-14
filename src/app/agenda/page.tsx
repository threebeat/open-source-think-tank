import type { Metadata } from "next";

import { HallPlaceholder } from "@/components/member/HallPlaceholder";
import { requireMemberSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agenda",
  description: "Commonhall Public Agenda placeholder — topics open in a later phase.",
};

export default async function AgendaPage() {
  await requireMemberSession();
  return (
    <HallPlaceholder
      title="Agenda"
      description="Qualified topics, consultation fixtures, and Public Agenda residency open in a later phase."
    />
  );
}
