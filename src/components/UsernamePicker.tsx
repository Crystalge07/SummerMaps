"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { checkUsernameAvailable } from "@/lib/api";
import {
  normalizeUsername,
  USERNAME_MAX,
  validateUsername,
} from "@/lib/username";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

export function UsernamePicker() {
  const { needsUsername, claimUsername, status, error: authError } = useAuth();
  const [raw, setRaw] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);

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
      <div className="consent-overlay" role="status" aria-live="polite">
        <div className="consent-card">
          <p className="panel-kicker">just a moment</p>
          <h2>Starting your session…</h2>
          <p>Setting up a private identity for your finds.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="consent-overlay"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auth-error-title"
      >
        <div className="consent-card">
          <p className="panel-kicker">connection</p>
          <h2 id="auth-error-title">Couldn&apos;t start a session</h2>
          <p>
            {authError ??
              "Enable anonymous sign-ins in the Supabase dashboard, then refresh."}
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!needsUsername) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    const invalid = validateUsername(username);
    if (invalid) {
      setSubmitError(invalid);
      return;
    }

    setBusy(true);
    try {
      await claimUsername(username);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "username_taken" || msg.includes("username_taken")) {
        setSubmitError("That username is taken. Try another.");
        setAvailability("taken");
      } else if (msg === "username_invalid") {
        setSubmitError("Use lowercase letters, numbers, and underscores only.");
      } else {
        setSubmitError(msg || "Could not claim that username.");
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
    <div
      className="consent-overlay username-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="username-title"
    >
      <div className="consent-card">
        <p className="panel-kicker">choose a name</p>
        <h2 id="username-title">What should friends call you?</h2>
        <p>
          This is the only name others see or search for. You can save the
          account with email later — until then, clearing browser data loses
          this identity.
        </p>
        <form className="username-form" onSubmit={(e) => void onSubmit(e)}>
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
          {submitError && <p className="status error">{submitError}</p>}
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
    </div>
  );
}
