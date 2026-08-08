"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/check-in", label: "Check in" },
  { href: "/path", label: "My path" },
  { href: "/friends", label: "Friends" },
  { href: "/city", label: "City" },
  { href: "/dashboard", label: "Pulse" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="site-nav">
      <Link href="/" className="brand">
        Pathline
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
