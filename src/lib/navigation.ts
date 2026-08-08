export type NavItem = {
  href: string;
  label: string;
};

export const primaryNav: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/process", label: "Process" },
  { href: "/join", label: "Join preview" },
  { href: "/topics", label: "Topics" },
  { href: "/agenda", label: "Agenda" },
  { href: "/transparency", label: "Transparency" },
  { href: "/about", label: "About" },
  { href: "/demo", label: "Demo" },
];

export function titleForPath(pathname: string): string {
  if (pathname === "/") {
    return "Home";
  }
  const match = primaryNav.find((item) => item.href === pathname);
  return match?.label ?? "Demonstration";
}
