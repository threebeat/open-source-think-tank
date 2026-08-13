export type NavItem = {
  href: string;
  label: string;
};

export const primaryNav: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/idea-commons", label: "Idea Commons" },
  { href: "/formal-topics", label: "Formal Topics" },
  { href: "/process", label: "Process" },
  { href: "/join", label: "How Joining Works" },
  { href: "/agenda", label: "Agenda" },
  { href: "/transparency", label: "The Public Record" },
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
