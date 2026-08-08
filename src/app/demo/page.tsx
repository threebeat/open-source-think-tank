import type { Metadata } from "next";

import { ShellPlaceholder } from "@/components/ShellPlaceholder";

export const metadata: Metadata = {
  title: "Guided demo",
};

export default function DemoPage() {
  return (
    <ShellPlaceholder
      breadcrumbLabel="Demo"
      title="Guided demo"
      description="A five-to-eight-minute guided walkthrough will live here."
    />
  );
}
