import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MainContainerProps = {
  children: ReactNode;
  className?: string;
  width?: "default" | "narrow";
};

export function MainContainer({
  children,
  className,
  width = "default",
}: MainContainerProps) {
  return (
    <main
      className={cn(
        "page-x mx-auto w-full flex-1 py-8 sm:py-10",
        width === "narrow" ? "max-w-3xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </main>
  );
}
