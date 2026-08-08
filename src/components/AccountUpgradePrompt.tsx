"use client";

import { useState } from "react";
import { upgradeAccount } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DISMISS_KEY = "pathline_upgrade_dismissed";

export function shouldOfferAccountUpgrade(isAnonymous: boolean): boolean {
  if (!isAnonymous) return false;
  try {
    return localStorage.getItem(DISMISS_KEY) !== "1";
  } catch {
    return true;
  }
}

export function AccountUpgradePrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isAnonymous, refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!open || !isAnonymous) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!trimmed || password.length < 6) {
      setError("Enter an email and a password (6+ characters).");
      return;
    }

    setBusy(true);
    try {
      await upgradeAccount(trimmed, password);
      await refreshSession();
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your account.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="consent-overlay username-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
    >
      <div className="consent-card">
        <p className="panel-kicker">keep your finds</p>
        <h2 id="upgrade-title">
          {done ? "Check your email" : "Save this account"}
        </h2>
        {done ? (
          <>
            <p>
              Confirm the link we sent to <strong>{email.trim()}</strong>. Until
              then — and if you clear browser storage or switch devices — this
              account can&apos;t be recovered. Same id, no data migration once
              you&apos;re confirmed.
            </p>
            <button type="button" className="btn primary" onClick={onClose}>
              Got it
            </button>
          </>
        ) : (
          <>
            <p>
              Right now your identity lives in this browser. Clear storage or
              switch devices and your check-ins, friends, and username are gone
              for good — there&apos;s no email to reset against. Add one after
              your first find so you can come back.
            </p>
            <form className="username-form" onSubmit={(e) => void onSubmit(e)}>
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
                  autoComplete="new-password"
                  minLength={6}
                  disabled={busy}
                  required
                />
              </label>
              {error && <p className="status error">{error}</p>}
              <div className="upgrade-actions">
                <button
                  type="submit"
                  className="btn primary"
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Send confirmation"}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={dismiss}
                  disabled={busy}
                >
                  Not now
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
