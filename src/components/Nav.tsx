"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/capture", label: "Capture" },
  { href: "/path", label: "My path" },
  { href: "/friends", label: "Friends" },
  { href: "/city", label: "City" },
  { href: "/dashboard", label: "Pulse" },
];

export function Nav() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
      behavior: "smooth",
    });
  }, [pathname]);

  return (
    <header className="site-nav">
      <Link href="/" className="brand">
        The Little Things
      </Link>
      <nav aria-label="Primary">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              ref={active ? activeRef : undefined}
              className={active ? "nav-link active" : "nav-link"}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
