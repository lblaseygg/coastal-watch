import Link from "next/link";

type PublicNavProps = {
  activeHref?: "/" | "/news" | "/legal-framework" | "/methodology" | "/admin";
  showAdmin?: boolean;
};

const NAV_ITEMS = [
  { href: "/", label: "Map" },
  { href: "/news", label: "News" },
  { href: "/legal-framework", label: "Legal framework" },
  { href: "/methodology", label: "Methodology" },
  { href: "/admin", label: "Admin" }
] as const;

export default function PublicNav({ activeHref, showAdmin = false }: PublicNavProps) {
  const navItems = showAdmin || activeHref === "/admin"
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.href !== "/admin");

  return (
    <div className="hero-nav">
      {navItems.map((item) => {
        const isActive = item.href === activeHref;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`hero-nav-link ${isActive ? "is-active" : ""}`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
