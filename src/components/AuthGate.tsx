"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { checkUsernameAvailable } from "@/lib/api";
import {
  normalizeUsername,
  USERNAME_MAX,
  validateUsername,
} from "@/lib/username";

type Mode = "sign_in" | "sign_up";
type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

export function AuthGate() {
  const {
    status,
    error: authError,
    needsAuth,
    needsUsername,
    retry,
    signIn,
    signUp,
    claimUsername,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("sign_up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmNote, setConfirmNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [raw, setRaw] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [usernameError, setUsernameError] = useState("");

  const username = normalizeUsername(raw);
  const formatError = username ? validateUsername(username) : null;

  useEffect(() => {
    if (!needsUsername) return;
    if (!username || formatError) {
      setAvailability(formatError ? "invalid" : "idle");
      return;
    }

    setAvailability("checking");
    const handle = window.setTimeout(() => {
      void checkUsernameAvailable(username)
        .then((ok) => setAvailability(ok ? "available" : "taken"))
        .catch(() => setAvailability("idle"));
    }, 350);

    return () => window.clearTimeout(handle);
  }, [needsUsername, username, formatError]);

  if (status === "loading") {
    return (
      <main className="auth-page">
        <div className="auth-page-inner">
          <p className="panel-kicker">just a moment</p>
          <h1>Loading…</h1>
          <p className="auth-lede">Checking for a saved session.</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="auth-page" aria-labelledby="auth-error-title">
        <div className="auth-page-inner">
          <p className="panel-kicker">connection</p>
          <h1 id="auth-error-title">Couldn&apos;t load auth</h1>
          <p className="auth-lede">
            {authError ?? "Something went wrong connecting to Supabase."}
          </p>
          <ol className="auth-error-steps">
            <li>
              SQL Editor → run the latest <code>supabase/schema.sql</code>
            </li>
            <li>
              Confirm Vercel / <code>.env.local</code> point at that Supabase
              project
            </li>
          </ol>
          <button type="button" className="btn primary" onClick={() => retry()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (needsAuth) {
    async function onAuthSubmit(e: React.FormEvent) {
      e.preventDefault();
      setFormError("");
      setConfirmNote("");
      const trimmed = email.trim();
      if (!trimmed || password.length < 6) {
        setFormError("Enter an email and a password (6+ characters).");
        return;
      }

      setBusy(true);
      try {
        if (mode === "sign_in") {
          await signIn(trimmed, password);
        } else {
          const result = await signUp(trimmed, password);
          if (result === "confirm") {
            setConfirmNote(
              "Check your email for a confirmation link, then come back and sign in.",
            );
            setMode("sign_in");
          }
        }
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Could not authenticate.",
        );
      } finally {
        setBusy(false);
      }
    }

    return (
      <main className="auth-page" aria-labelledby="auth-title">
        <div className="auth-page-inner">
          <p className="brand auth-brand">The Little Things</p>
          <p className="panel-kicker">your account</p>
          <h1 id="auth-title">
            {mode === "sign_up" ? "Create an account" : "Welcome back"}
          </h1>
          <p className="auth-lede">
            {mode === "sign_up"
              ? "Email keeps your finds recoverable. Friends only see the username you pick next — never your email."
              : "Sign in to get back to your path and friends."}
          </p>
          <form className="auth-form" onSubmit={(e) => void onAuthSubmit(e)}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={busy}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "sign_up" ? "new-password" : "current-password"
                }
                minLength={6}
                disabled={busy}
                required
              />
            </label>
            {formError && <p className="status error">{formError}</p>}
            {confirmNote && <p className="status">{confirmNote}</p>}
            <button type="submit" className="btn primary" disabled={busy}>
              {busy
                ? "Working…"
                : mode === "sign_up"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>
          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setMode(mode === "sign_up" ? "sign_in" : "sign_up");
              setFormError("");
              setConfirmNote("");
            }}
            disabled={busy}
          >
            {mode === "sign_up"
              ? "Already have an account? Sign in"
              : "Need an account? Sign up"}
          </button>
        </div>
      </main>
    );
  }

  if (!needsUsername) return null;

  async function onUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUsernameError("");
    const invalid = validateUsername(username);
    if (invalid) {
      setUsernameError(invalid);
      return;
    }

    setBusy(true);
    try {
      await claimUsername(username);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "username_taken" || msg.includes("username_taken")) {
        setUsernameError("That username is taken. Try another.");
        setAvailability("taken");
      } else if (msg === "username_invalid") {
        setUsernameError("Use lowercase letters, numbers, and underscores only.");
      } else {
        setUsernameError(msg || "Could not claim that username.");
      }
    } finally {
      setBusy(false);
    }
  }

  const hint =
    availability === "checking"
      ? "Checking…"
      : availability === "available"
        ? "Available"
        : availability === "taken"
          ? "Taken — try another"
          : availability === "invalid"
            ? formatError
            : "Letters, numbers, underscores · 3–20 characters";

  return (
    <main className="auth-page" aria-labelledby="username-title">
      <div className="auth-page-inner">
        <p className="brand auth-brand">The Little Things</p>
        <p className="panel-kicker">choose a name</p>
        <h1 id="username-title">What should friends call you?</h1>
        <p className="auth-lede">
          This is the only name others see or search for. Your email stays
          private.
        </p>
        <form
          className="auth-form"
          onSubmit={(e) => void onUsernameSubmit(e)}
        >
          <label className="field">
            <span>Username</span>
            <input
              value={raw}
              onChange={(e) =>
                setRaw(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "")
                    .slice(0, USERNAME_MAX),
                )
              }
              placeholder="e.g. soft_sneakers"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={USERNAME_MAX}
              disabled={busy}
              aria-describedby="username-hint"
            />
          </label>
          <p
            id="username-hint"
            className={`username-hint${
              availability === "taken" || availability === "invalid"
                ? " error"
                : availability === "available"
                  ? " ok"
                  : ""
            }`}
          >
            {hint}
          </p>
          {usernameError && <p className="status error">{usernameError}</p>}
          <button
            type="submit"
            className="btn primary"
            disabled={
              busy ||
              !username ||
              Boolean(formatError) ||
              availability === "taken" ||
              availability === "checking"
            }
          >
            {busy ? "Claiming…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
