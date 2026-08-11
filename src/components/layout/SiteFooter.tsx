import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-muted">
      <div className="page-x mx-auto flex max-w-6xl flex-col gap-4 py-8 text-sm leading-6 text-muted-foreground safe-bottom">
        <p>
          Demonstration of a proposed project. Synthetic data only. Not a claim
          that an organization is incorporated, tax-exempt, legally reviewed, or
          accepting members.
        </p>
        <p>
          Build contract:{" "}
          <Link href="/about" className="text-primary underline-offset-4 hover:underline">
            About
          </Link>
          {" · "}
          <Link
            href="/transparency"
            className="text-primary underline-offset-4 hover:underline"
          >
            The Public Record
          </Link>
          {" · "}
          <Link href="/demo" className="text-primary underline-offset-4 hover:underline">
            Guided demo
          </Link>
        </p>
      </div>
    </footer>
  );
}
