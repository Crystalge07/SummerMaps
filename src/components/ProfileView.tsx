"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ensureDeviceProfile, getAllCheckins, getTodayCityCheckins } from "@/lib/api";
import { useAuthOptional } from "@/lib/auth";
import { getDeviceId } from "@/lib/device";
import type { DeviceProfile } from "@/lib/types";
import { MemoriesPanel } from "./MemoriesPanel";

const SHARE_ORIGIN = "https://summer-maps.vercel.app";

/** Activity, share, and friends — account chrome lives in AuthGate above. */
export function ProfileView() {
  const auth = useAuthOptional();
  const username = auth?.profile?.username;
  const email = (auth?.user?.email ?? "").trim();
  const hasEmail = Boolean(email && email !== "—");
  const memberSince = auth?.profile?.created_at;
  const signedIn = Boolean(auth?.user && auth?.profile);

  const [me, setMe] = useState<DeviceProfile | null>(null);
  const [capturesToday, setCapturesToday] = useState(0);
  const [capturesAll, setCapturesAll] = useState(0);
  const [copied, setCopied] = useState<"username" | "link" | "email" | null>(
    null,
  );
  const [signingOut, setSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const shareUrl = useMemo(() => {
    if (!username) return "";
    return `${SHARE_ORIGIN}/friends?add=${encodeURIComponent(username)}`;
  }, [username]);

  useEffect(() => {
    const deviceId = getDeviceId();
    void ensureDeviceProfile(deviceId, username).then(setMe);

    void Promise.all([getTodayCityCheckins(), getAllCheckins()]).then(
      ([today, all]) => {
        setCapturesToday(today.filter((c) => c.device_id === deviceId).length);
        setCapturesAll(all.filter((c) => c.device_id === deviceId).length);
      },
    );
  }, [username]);

  async function copyText(
    text: string,
    kind: "username" | "link" | "email",
  ) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  async function onShare() {
    if (!shareUrl || !username) return;
    const text = `Find me on The Little Things — I'm @${username}. Add me at summer-maps.vercel.app/friends?add=${username}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "The Little Things",
          text,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    await copyText(shareUrl, "link");
  }

  async function onSignOut() {
    if (!auth) return;
    setSigningOut(true);
    try {
      await auth.signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="profile-page">
      {!signedIn && (
        <header className="profile-identity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/default-avatar.svg"
            alt=""
            className="profile-avatar-img"
          />
          <div className="profile-header-copy">
            <h1>Your profile</h1>
            <p className="meta">Device stats for this phone</p>
          </div>
        </header>
      )}

      {signedIn && memberSince && (
        <p className="meta profile-member-since">
          Member since {format(new Date(memberSince), "MMM d, yyyy")}
        </p>
      )}

      {hasEmail && (
        <section className="profile-block">
          <button
            type="button"
            className="profile-settings-toggle"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            <span>Settings</span>
            <span aria-hidden="true">{settingsOpen ? "−" : "+"}</span>
          </button>
          {settingsOpen && (
            <div className="profile-settings-body">
              <div className="profile-row">
                <div>
                  <span className="profile-row-label">Email</span>
                  <strong className="profile-row-value">{email}</strong>
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void copyText(email, "email")}
                >
                  {copied === "email" ? "Copied" : "Copy"}
                </button>
              </div>
              {signedIn && (
                <button
                  type="button"
                  className="btn ghost profile-signout-btn"
                  disabled={signingOut}
                  onClick={() => void onSignOut()}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <section className="profile-block">
        <h2>Your activity</h2>
        <div className="profile-activity-stats">
          <div>
            <strong>{capturesToday}</strong>
            <span>captures today</span>
          </div>
          <div>
            <strong>{capturesAll}</strong>
            <span>all-time captures</span>
          </div>
        </div>
        <Link className="btn primary" href="/map?layer=mine">
          Open my path
        </Link>
      </section>

      <MemoriesPanel />

      <section className="profile-block profile-share-block">
        <h2>Share</h2>
        {username ? (
          <>
            <p className="meta">
              Let friends find you with your username or a link.
            </p>
            <p className="profile-handle">@{username}</p>
            <div className="profile-share-actions">
              <button
                type="button"
                className="btn primary"
                onClick={() => void copyText(username, "username")}
              >
                {copied === "username" ? "Copied" : "Copy username"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={!shareUrl}
                onClick={() => void onShare()}
              >
                {copied === "link" ? "Link copied" : "Share"}
              </button>
            </div>
          </>
        ) : (
          <p className="meta">
            Choose a username above so friends can find you.
          </p>
        )}
      </section>

      <section className="profile-block">
        <h2>Friends</h2>
        <p className="meta">
          Add people, share your handle, and see their paths on the map.
        </p>
        <Link className="btn primary" href="/friends">
          Open friends
        </Link>
      </section>

      {signedIn && !hasEmail && (
        <button
          type="button"
          className="profile-signout-link"
          disabled={signingOut}
          onClick={() => void onSignOut()}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      )}
    </div>
  );
}
