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
    href: "/friends",
    label: "Friends",
    match: (path: string) => path.startsWith("/friends"),
    icon: FriendsIcon,
  },
  {
    href: "/profile",
    label: "Profile",
    match: (path: string) => path.startsWith("/profile"),
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

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon">
      <path
        fill="currentColor"
        d="M12 3.2 3.5 10.2v10.3h6.2v-6.1h4.6v6.1h6.2V10.2L12 3.2z"
      />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon">
      <path
        fill="currentColor"
        d="M14.5 3.2 9.5 5.1 3.5 3.2v17.6l6 1.9 5-1.9 6 1.9V4.1l-6-0.9zm0 1.9 4.5.7v13.6l-4.5-1.4V5.1zm-5 1.7v13.6l-4.5-1.4V5.4l4.5 1.4z"
      />
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon">
      <path
        fill="currentColor"
        d="M8.5 7.5a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6zm7 1.2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM4.2 18.8c.4-2.6 2.6-4.2 4.3-4.2h.1c1.7 0 3.9 1.6 4.3 4.2v.5H4.2v-.5zm8.9-.3c-.2-1.5.2-2.8 1-3.7.7-.8 1.7-1.2 2.7-1.2h.2c1.4 0 3.1 1.2 3.6 3.4v.5h-7.5v-.1z"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tab-icon">
      <path
        fill="currentColor"
        d="M12 4.5a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zM5.2 19.5c.5-3.2 3.2-5.2 6.8-5.2s6.3 2 6.8 5.2v.8H5.2v-.8z"
      />
    </svg>
  );
}
