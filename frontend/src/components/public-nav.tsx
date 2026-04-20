import Link from "next/link";

type PublicNavProps = {
  activeHref?: "/" | "/news" | "/legal-framework" | "/methodology" | "/admin";
};

const NAV_ITEMS = [
  { href: "/", label: "Map" },
  { href: "/news", label: "News" },
  { href: "/legal-framework", label: "Legal framework" },
  { href: "/methodology", label: "Methodology" },
  { href: "/admin", label: "Admin" }
] as const;

export default function PublicNav({ activeHref }: PublicNavProps) {
  return (
    <div className="hero-nav">
      {NAV_ITEMS.map((item) => {
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
