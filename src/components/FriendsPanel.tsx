"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addFriend,
  ensureDeviceProfile,
  getFriendDeviceIds,
  getProfileByDevice,
} from "@/lib/api";
import { colorForDevice } from "@/lib/colors";
import { getDeviceId } from "@/lib/device";
import type { DeviceProfile } from "@/lib/types";
import { DemoSeedButton } from "./DemoSeedButton";

const SHARE_ORIGIN = "https://summer-maps.vercel.app";

export function FriendsPanel({ initialCode = "" }: { initialCode?: string }) {
  const [me, setMe] = useState<DeviceProfile | null>(null);
  const [friends, setFriends] = useState<DeviceProfile[]>([]);
  const [code, setCode] = useState(initialCode.slice(0, 6));
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    if (initialCode) setCode(initialCode.slice(0, 6).toUpperCase());
  }, [initialCode]);

  const shareUrl = useMemo(
    () => (me ? `${SHARE_ORIGIN}/friends?add=${me.code}` : ""),
    [me],
  );

  async function refresh() {
    const deviceId = getDeviceId();
    const profile = await ensureDeviceProfile(deviceId);
    setMe(profile);
    const ids = await getFriendDeviceIds(deviceId);
    const profiles = (
      await Promise.all(
        ids.map(async (id) => {
          const existing = await getProfileByDevice(id);
          return existing ?? ensureDeviceProfile(id);
        }),
      )
    ).filter(Boolean) as DeviceProfile[];
    setFriends(profiles);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function copyText(value: string, kind: "code" | "link") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  }

  async function onCopyCode() {
    if (!me) return;
    await copyText(me.code, "code");
  }

  async function onShare() {
    if (!me) return;
    const text = `Find me on Pathline — my code is ${me.code}. Add me at summer-maps.vercel.app/friends?add=${me.code}`;
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

  async function onAddFriend(e: React.FormEvent) {
    e.preventDefault();
    setSuccess("");
    setError("");
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setAdding(true);
    try {
      await addFriend(getDeviceId(), trimmed);
      setSuccess("Friend added! Open the map to see their path.");
      setCode("");
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not add friend.";
      if (msg.includes("No one found") || msg.includes("friend code")) {
        setError(
          "That code doesn't match anyone. Double-check and try again.",
        );
      } else if (msg.includes("already connected")) {
        setError("You're already connected.");
      } else if (msg.includes("yourself")) {
        setError("That's your own code.");
      } else {
        setError(msg);
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="friends-page">
      {me && (
        <section className="friends-hero-card">
          <p className="friends-label">Your friend code</p>
          <div
            className="friends-code-display"
            aria-label={`Friend code ${me.code}`}
          >
            {me.code}
          </div>
          <div className="friends-hero-actions">
            <button type="button" className="btn primary" onClick={onCopyCode}>
              {copied === "code" ? "Copied ✓" : "Copy code"}
            </button>
            <button type="button" className="btn ghost" onClick={onShare}>
              Share
            </button>
          </div>
          <button
            type="button"
            className="friends-link-copy"
            onClick={() => copyText(shareUrl, "link")}
          >
            <span>Or share this link:</span>
            <em>{shareUrl.replace(/^https?:\/\//, "")}</em>
            <CopyIcon />
            {copied === "link" ? <strong>Copied ✓</strong> : null}
          </button>
        </section>
      )}

      <section className="friends-section">
        <h2>Add a friend</h2>
        <form className="friends-add-form" onSubmit={onAddFriend}>
          <input
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
            }
            placeholder="Enter their code"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Friend code"
          />
          <button
            type="submit"
            className="btn primary friends-add-btn"
            disabled={!code.trim() || adding}
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </form>
        {success && <p className="status">{success}</p>}
        {error && <p className="status error">{error}</p>}
      </section>

      <section className="friends-section">
        <h2>
          Your circle <span className="friends-count">{friends.length}</span>
        </h2>

        {friends.length === 0 ? (
          <div className="friends-empty">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/path-mark.svg" alt="" width={56} height={56} />
            <p>No one in your circle yet.</p>
            <p className="meta">Share your code to get started.</p>
          </div>
        ) : (
          <ul className="friends-contact-list">
            {friends.map((f) => (
              <li key={f.device_id}>
                <a className="friends-contact-row" href="/friends/map">
                  <span
                    className="friends-color-dot"
                    style={{ background: colorForDevice(f.device_id) }}
                  />
                  <span className="friends-contact-name">
                    {f.display_name?.trim() || f.code}
                  </span>
                  <span className="friends-contact-go" aria-hidden>
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {friends.length > 0 && (
        <a className="btn primary friends-map-cta" href="/friends/map">
          Open friends map
        </a>
      )}

      <DemoSeedButton onLoaded={refresh} />
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
