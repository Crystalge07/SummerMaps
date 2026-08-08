"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { AuthGate } from "@/components/AuthGate";
import { LocationConsent } from "@/components/LocationConsent";
import { TabBar } from "@/components/TabBar";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

const SPLASH_MS = 1800;

/** Hides the app shell until splash + session/username are ready. */
export function AppChrome({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setSplashDone(true), SPLASH_MS);
    return () => window.clearTimeout(id);
  }, []);

  const authLoading = isSupabaseConfigured && auth.status === "loading";
  if (authLoading || !splashDone) {
    return <AppLoadingScreen />;
  }

  const blocked =
    isSupabaseConfigured &&
    (auth.status === "error" || auth.needsAuth || auth.needsUsername);

  if (blocked) {
    return <AuthGate />;
  }

  return (
    <>
      <div className="app-shell">{children}</div>
      <LocationConsent />
      <TabBar />
    </>
  );
}
