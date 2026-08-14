"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import type { NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type SiteHeaderAccount = {
  href: string;
  label: string;
  detail?: string;
};

type SiteHeaderProps = {
  items: NavItem[];
  account?: SiteHeaderAccount | null;
};

export function SiteHeader({ items, account }: SiteHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="border-b border-border bg-transparent">
      <div className="page-x mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-3 py-2">
        <Link
          href="/"
          className="min-h-11 min-w-11 rounded-md px-2 py-2 text-sm font-semibold tracking-tight text-foreground transition-colors hover:bg-muted active:bg-muted/80"
          onClick={() => setOpen(false)}
        >
          Commonhall
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            Pre-alpha
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-md px-3 text-sm transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {account ? (
            <Link
              href={account.href}
              className={cn(
                buttonVariants({ size: "lg" }),
                "hidden min-h-11 px-4 lg:inline-flex",
              )}
              aria-current={pathname.startsWith("/account") ? "page" : undefined}
              data-testid="account-button"
            >
              <span className="flex flex-col items-start leading-tight">
                <span>Account</span>
                <span className="text-[0.7rem] font-normal opacity-90">
                  {account.detail ?? account.label}
                </span>
              </span>
            </Link>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 min-w-11 lg:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close menu" : "Menu"}
          </Button>
        </div>
      </div>

      <div
        id={panelId}
        data-testid="mobile-primary-nav"
        hidden={!open}
        className="max-h-[min(70dvh,calc(100dvh-6rem))] overflow-y-auto overscroll-contain border-t border-border bg-surface page-x safe-bottom lg:hidden"
      >
        <nav aria-label="Primary mobile" className="mx-auto max-w-6xl py-3">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex min-h-11 items-center rounded-md px-3 text-base transition-colors hover:bg-muted active:bg-muted/80",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {account ? (
              <li>
                <Link
                  href={account.href}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "mt-2 flex min-h-11 w-full justify-start px-3",
                  )}
                  data-testid="account-button-mobile"
                  onClick={() => setOpen(false)}
                >
                  Account · {account.detail ?? account.label}
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </header>
  );
}
