import type { Metadata } from "next";

import { ShellPlaceholder } from "@/components/ShellPlaceholder";

export const metadata: Metadata = {
  title: "Agenda",
};

export default function AgendaPage() {
  return (
    <ShellPlaceholder
      breadcrumbLabel="Agenda"
      title="Agenda"
      description="Agenda qualification rules and synthetic agenda items will live here."
    />
  );
}
