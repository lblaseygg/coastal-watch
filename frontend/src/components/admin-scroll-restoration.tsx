"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function storageKeyForLocation(pathname: string, search: string): string {
  return `coastal-watch:admin-scroll:${pathname}?${search}`;
}

export default function AdminScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    const storageKey = storageKeyForLocation(pathname, search);

    const restoreScroll = () => {
      const storedValue = window.sessionStorage.getItem(storageKey);
      if (!storedValue) {
        return;
      }

      const scrollY = Number.parseFloat(storedValue);
      if (Number.isNaN(scrollY)) {
        return;
      }

      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: "auto" });
      });
    };

    const saveScroll = () => {
      window.sessionStorage.setItem(storageKey, String(window.scrollY));
    };

    restoreScroll();
    window.addEventListener("pagehide", saveScroll);
    window.addEventListener("beforeunload", saveScroll);

    return () => {
      saveScroll();
      window.removeEventListener("pagehide", saveScroll);
      window.removeEventListener("beforeunload", saveScroll);
    };
  }, [pathname, search]);

  return null;
}
