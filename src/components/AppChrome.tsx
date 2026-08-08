"use client";

import type { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { LocationConsent } from "@/components/LocationConsent";
import { TabBar } from "@/components/TabBar";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

/** Hides the app shell until the user has a session + username. */
export function AppChrome({ children }: { children: ReactNode }) {
  const auth = useAuth();

  const blocked =
    isSupabaseConfigured &&
    (auth.status === "loading" ||
      auth.status === "error" ||
      auth.needsAuth ||
      auth.needsUsername);

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
