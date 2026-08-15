"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      router.replace("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11")}
      disabled={pending}
      onClick={() => void onClick()}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
