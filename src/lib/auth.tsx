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
  /** True when Supabase is on and there is no session yet. */
  needsAuth: boolean;
  needsUsername: boolean;
  error: string | null;
  retry: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<"session" | "confirm">;
  signOut: () => Promise<void>;
  claimUsername: (username: string) => Promise<Profile>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (typeof err === "string" && err.trim()) return err;
  return "Something went wrong with auth.";
}

function friendlyAuthError(err: unknown): string {
  const raw = errorMessage(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("relation") &&
    lower.includes("profiles") &&
    lower.includes("does not exist")
  ) {
    return (
      "Supabase is missing the profiles table. Run the latest supabase/schema.sql in the SQL editor, then try again."
    );
  }

  if (lower.includes("claim_username") || lower.includes("search_profiles")) {
    return (
      "Supabase is missing username RPCs. Run the latest supabase/schema.sql in the SQL editor, then try again."
    );
  }

  if (lower.includes("email not confirmed")) {
    return "Confirm your email from the link we sent, then sign in.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Wrong email or password.";
  }

  if (lower.includes("user already registered")) {
    return "That email already has an account — sign in instead.";
  }

  return raw;
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
      setSession(null);
      setProfile(null);
      setStatus("ready");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setStatus("ready");
      return;
    }

    try {
      setStatus("loading");
      setError(null);
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      await applySession(data.session);
      setStatus("ready");
    } catch (err) {
      setError(friendlyAuthError(err));
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
      void applySession(next)
        .then(() => setStatus("ready"))
        .catch((err) => {
          setError(friendlyAuthError(err));
          setStatus("error");
        });
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  const user = session?.user ?? null;
  const needsAuth =
    isSupabaseConfigured && status === "ready" && !session;
  const needsUsername =
    isSupabaseConfigured && status === "ready" && Boolean(user) && !profile;

  async function signIn(email: string, password: string) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(friendlyAuthError(signInError));
    await applySession(data.session);
    setStatus("ready");
  }

  async function signUp(
    email: string,
    password: string,
  ): Promise<"session" | "confirm"> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signUpError) throw new Error(friendlyAuthError(signUpError));

    if (data.session) {
      await applySession(data.session);
      setStatus("ready");
      return "session";
    }

    // Confirm-email is on — no session until they click the link.
    return "confirm";
  }

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setStatus("ready");
  }

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
    needsAuth,
    needsUsername,
    error,
    retry: () => {
      void bootstrap();
    },
    signIn,
    signUp,
    signOut,
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
