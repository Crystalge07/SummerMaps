"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { LocationConsent } from "@/components/LocationConsent";
import { TabBar } from "@/components/TabBar";

const SPLASH_MS = 1800;

/** App shell — splash sphere on boot; login is optional via Profile. */
export function AppChrome({ children }: { children: ReactNode }) {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setSplashDone(true), SPLASH_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (!splashDone) {
    return (
      <div className="app-frame">
        <AppLoadingScreen />
      </div>
    );
  }

  return (
    <div className="app-frame">
      <div className="app-shell">{children}</div>
      <LocationConsent />
      <TabBar />
    </div>
  );
}
