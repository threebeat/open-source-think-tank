export type NavItem = {
  href: string;
  label: string;
};

export const publicNav: NavItem[] = [
  { href: "/demo", label: "Demo" },
  { href: "/about", label: "About" },
  { href: "/join", label: "Create account" },
  { href: "/auth/sign-in", label: "Sign in" },
];

export const memberNav: NavItem[] = [
  { href: "/commons", label: "Commons" },
  { href: "/agenda", label: "Agenda" },
  { href: "/chamber", label: "Chamber" },
  { href: "/council", label: "Council" },
  { href: "/about", label: "About" },
];

export function navForSession(authenticated: boolean): NavItem[] {
  return authenticated ? memberNav : publicNav;
}

export function titleForPath(pathname: string): string {
  if (pathname === "/") {
    return "Home";
  }
  const match = [...publicNav, ...memberNav].find((item) => item.href === pathname);
  return match?.label ?? "Commonhall";
}
