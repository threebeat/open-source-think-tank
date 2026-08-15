import { redirect } from "next/navigation";
import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { PasswordSignInForm } from "@/components/auth/PasswordSignInForm";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
  description: "Sign in to Commonhall with your identifier and password.",
};

export default async function SignInPage() {
  if (resolveAppMode() === "gated") {
    const { requireGatedSession } = await import("@/lib/auth/guard");
    const gated = await requireGatedSession();
    if (gated.ok) {
      redirect("/account");
    }
  } else {
    const { readPreAlphaSessionFromStore } = await import(
      "@/lib/auth/pre-alpha-local"
    );
    if (await readPreAlphaSessionFromStore()) {
      redirect("/account");
    }
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Sign in" }]}
      />
      <PageHeader
        eyebrow="Pre-alpha"
        title="Sign in"
        description="Use the identifier and password from when you created your account."
      />
      <DisclosureNotice title="Local identifier only" tone="caution">
        No outbound email is sent from this form. Passwords are hashed and never
        placed in URLs.
      </DisclosureNotice>
      <PasswordSignInForm />
      <p className="text-sm">
        Need an account?{" "}
        <Link className="underline" href="/join">
          Create an account
        </Link>
      </p>
    </MainContainer>
  );
}
