"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navItems = showAdmin || activeHref === "/admin" ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== "/admin");

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeHref]);

  return (
    <nav className={`hero-nav ${isMobileMenuOpen ? "is-open" : ""}`} aria-label="Primary">
      <button
        aria-controls="public-nav-menu"
        aria-expanded={isMobileMenuOpen}
        className="hero-nav-toggle"
        onClick={() => setIsMobileMenuOpen((current) => !current)}
        type="button"
      >
        <span className="hero-nav-toggle-line" />
        <span className="hero-nav-toggle-line" />
        <span className="hero-nav-toggle-line" />
        <span className="sr-only">{isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}</span>
      </button>

      <div className="hero-nav-menu" id="public-nav-menu">
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
    </nav>
  );
}
