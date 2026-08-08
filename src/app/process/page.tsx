import type { Metadata } from "next";

import { ShellPlaceholder } from "@/components/ShellPlaceholder";

export const metadata: Metadata = {
  title: "Process",
};

export default function ProcessPage() {
  return (
    <ShellPlaceholder
      breadcrumbLabel="Process"
      title="Process"
      description="A seven-stage explanation of the institutional pipeline will live here."
    />
  );
}
