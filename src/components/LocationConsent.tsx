"use client";

import { useEffect, useState } from "react";
import { getCurrentPosition } from "@/lib/geo";

const CONSENT_KEY = "pathline_location_consent";

export function LocationConsent() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setOpen(true);
    } catch {
      // private mode / blocked storage — skip gate
    }
  }, []);

  async function accept() {
    setBusy(true);
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // ignore
    }
    try {
      // Warm the browser permission prompt once up front.
      await getCurrentPosition();
    } catch {
      // User may deny; check-in flow will block until location is available.
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div className="consent-overlay" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="consent-card">
        <p className="panel-kicker">before you begin</p>
        <h2 id="consent-title">Share your place</h2>
        <p>
          When you capture a find, we pin it where you are so your path and the
          city map stay true. Your browser will ask for location access next —
          you can change that anytime in settings.
        </p>
        <button
          type="button"
          className="btn primary"
          onClick={() => void accept()}
          disabled={busy}
        >
          {busy ? "Asking…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
