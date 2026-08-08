"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  claimUsername as claimUsernameApi,
  getAuthProfile,
  ensureDeviceProfile,
} from "@/lib/api";
import { syncDeviceIdToUser } from "@/lib/device";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type AuthStatus = "loading" | "ready" | "error";

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAnonymous: boolean;
  needsUsername: boolean;
  error: string | null;
  claimUsername: (username: string) => Promise<Profile>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readIsAnonymous(user: User | null): boolean {
  if (!user) return false;
  if (typeof user.is_anonymous === "boolean") return user.is_anonymous;
  const claim = user.app_metadata?.provider === "anonymous";
  return claim;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile(userId: string) {
    const row = await getAuthProfile(userId);
    setProfile(row);
    if (row) {
      await ensureDeviceProfile(userId, row.username);
    } else {
      await ensureDeviceProfile(userId);
    }
  }

  async function applySession(next: Session | null) {
    setSession(next);
    if (!next?.user) {
      setProfile(null);
      return;
    }
    syncDeviceIdToUser(next.user.id);
    await loadProfile(next.user.id);
  }

  async function bootstrap() {
    if (!isSupabaseConfigured) {
      setStatus("ready");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setStatus("ready");
      return;
    }

    try {
      setError(null);
      const { data: existing, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      let next = existing.session;
      if (!next) {
        const { data, error: anonError } =
          await supabase.auth.signInAnonymously();
        if (anonError) throw anonError;
        next = data.session;
      }

      await applySession(next);
      setStatus("ready");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not start a session. Check anonymous sign-ins are enabled.";
      setError(message);
      setStatus("error");
    }
  }

  useEffect(() => {
    void bootstrap();

    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      void applySession(next).catch(() => {
        /* profile load errors surface on next explicit action */
      });
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  const user = session?.user ?? null;
  const isAnonymous = readIsAnonymous(user);
  const needsUsername =
    isSupabaseConfigured && status === "ready" && Boolean(user) && !profile;

  async function claimUsername(username: string): Promise<Profile> {
    const row = await claimUsernameApi(username);
    setProfile(row);
    return row;
  }

  async function refreshProfile() {
    if (!user) return;
    await loadProfile(user.id);
  }

  async function refreshSession() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error: refreshError } = await supabase.auth.getSession();
    if (refreshError) throw refreshError;
    await applySession(data.session);
  }

  const value: AuthContextValue = {
    status,
    session,
    user,
    profile,
    isAnonymous,
    needsUsername,
    error,
    claimUsername,
    refreshProfile,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

/** Safe for components that may render outside the provider during SSR. */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
