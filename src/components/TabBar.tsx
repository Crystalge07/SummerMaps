"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "Home",
    match: (path: string) => path === "/",
    icon: HomeIcon,
  },
  {
    href: "/map",
    label: "Map",
    match: (path: string) => path.startsWith("/map"),
    icon: MapIcon,
  },
  {
    href: "/insights",
    label: "Insights",
    match: (path: string) => path.startsWith("/insights"),
    icon: InsightsIcon,
  },
  {
    href: "/profile",
    label: "Profile",
    match: (path: string) =>
      path.startsWith("/profile") || path.startsWith("/friends"),
    icon: ProfileIcon,
  },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tab-bar" aria-label="Primary">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "tab-item active" : "tab-item"}
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon">
      <path {...strokeProps} d="M4 11.5 12 4l8 7.5" />
      <path {...strokeProps} d="M6 10v9.5h12V10" />
      <path {...strokeProps} d="M10 19.5v-6h4v6" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon">
      <path
        {...strokeProps}
        d="M14.5 4 9.5 5.8 3.5 4v14.5l6 1.7 5-1.7 6 1.7V5.5z"
      />
      <path {...strokeProps} d="M9.5 5.8v14.4M14.5 4v14.5" />
    </svg>
  );
}

function InsightsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon">
      <path {...strokeProps} d="M5 18V10" />
      <path {...strokeProps} d="M10 18V6" />
      <path {...strokeProps} d="M15 18v-8" />
      <path {...strokeProps} d="M20 18V8" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon">
      <circle cx="12" cy="8.2" r="3.6" {...strokeProps} />
      <path {...strokeProps} d="M5.2 19.5c.5-3.2 3.2-5.2 6.8-5.2s6.3 2 6.8 5.2" />
    </svg>
  );
}
