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
  description: "Sign in to Commonhall with your local identifier and password.",
};

export default function SignInPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Sign in" }]}
      />
      <PageHeader
        eyebrow="Gated pre-alpha"
        title="Sign in"
        description="Use the identifier and password from enrollment. Invite-created staff accounts may still complete a one-time link."
      />
      <DisclosureNotice title="Local identifier only" tone="caution">
        No outbound email is sent from this form. Passwords are hashed at rest
        and never placed in URLs.
      </DisclosureNotice>
      <PasswordSignInForm />
      <p className="text-sm">
        Need an account?{" "}
        <Link className="underline" href="/join">
          Create an account
        </Link>
        {" · "}
        <Link className="underline" href="/auth/accept">
          Accept invitation
        </Link>
      </p>
    </MainContainer>
  );
}
