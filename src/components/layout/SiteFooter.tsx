import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-muted">
      <div className="page-x mx-auto flex max-w-6xl flex-col gap-4 py-8 text-sm leading-6 text-muted-foreground safe-bottom">
        <p>
          Commonhall v2 is a working name for a proposed computational-democracy
          digital town hall. This pre-alpha uses synthetic data. Community
          membership here is not nonprofit membership, statutory membership, or
          government standing.
        </p>
        <p>
          <Link href="/demo" className="text-primary underline-offset-4 hover:underline">
            Tour the demo
          </Link>
          {" · "}
          <Link href="/about" className="text-primary underline-offset-4 hover:underline">
            About
          </Link>
          {" · "}
          <Link href="/join" className="text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
          {" · "}
          <Link
            href="/auth/sign-in"
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </footer>
  );
}
