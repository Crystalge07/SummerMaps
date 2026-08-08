"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { AuthGate } from "@/components/AuthGate";
import { LocationConsent } from "@/components/LocationConsent";
import { TabBar } from "@/components/TabBar";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

const SPLASH_MS = 1800;

/** Splash first, then require sign-in + username, then show the app. */
export function AppChrome({ children }: { children: ReactNode }) {
  const auth = useAuth();
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

  if (!isSupabaseConfigured) {
    return (
      <div className="app-frame">
        <main className="auth-page">
          <div className="auth-page-inner">
            <p className="brand auth-brand">The Little Things</p>
            <p className="panel-kicker">account required</p>
            <h1>Sign-in unavailable</h1>
            <p className="lede">
              Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
              <code>.env.local</code>, then restart the server.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (auth.status === "loading") {
    return (
      <div className="app-frame">
        <main className="auth-page">
          <div className="auth-page-inner">
            <p className="brand auth-brand">The Little Things</p>
            <p className="lede">Checking for a saved session…</p>
          </div>
        </main>
      </div>
    );
  }

  if (auth.status === "error" || auth.needsAuth || auth.needsUsername) {
    return (
      <div className="app-frame">
        <main className="auth-page">
          <div className="auth-page-inner">
            <p className="brand auth-brand">The Little Things</p>
            <AuthGate />
          </div>
        </main>
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
