"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { primaryNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function SiteHeader() {
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
          Open-Source Think Tank
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            Demonstration
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {primaryNav.map((item) => {
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

      <div
        id={panelId}
        data-testid="mobile-primary-nav"
        hidden={!open}
        className="max-h-[min(70dvh,calc(100dvh-6rem))] overflow-y-auto overscroll-contain border-t border-border bg-surface page-x safe-bottom lg:hidden"
      >
        <nav aria-label="Primary mobile" className="mx-auto max-w-6xl py-3">
          <ul className="flex flex-col gap-1">
            {primaryNav.map((item) => {
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
          </ul>
        </nav>
      </div>
    </header>
  );
}
