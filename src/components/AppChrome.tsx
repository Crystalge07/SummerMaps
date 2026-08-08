"use client";

import type { ReactNode } from "react";
import { LocationConsent } from "@/components/LocationConsent";
import { TabBar } from "@/components/TabBar";

/** App shell — always available; login is optional via Profile. */
export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="app-shell">{children}</div>
      <LocationConsent />
      <TabBar />
    </>
  );
}
