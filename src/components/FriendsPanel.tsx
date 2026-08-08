"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addFriend,
  addFriendByUsername,
  ensureDeviceProfile,
  getFriendDeviceIds,
  getProfileByDevice,
  searchProfiles,
} from "@/lib/api";
import { useAuthOptional } from "@/lib/auth";
import { colorForDevice } from "@/lib/colors";
import { getDeviceId } from "@/lib/device";
import type { DeviceProfile, Profile } from "@/lib/types";
import { normalizeUsername } from "@/lib/username";
import { DemoSeedButton } from "./DemoSeedButton";

const SHARE_ORIGIN = "https://summer-maps.vercel.app";

export function FriendsPanel({ initialCode = "" }: { initialCode?: string }) {
  const auth = useAuthOptional();
  const [me, setMe] = useState<DeviceProfile | null>(null);
  const [friends, setFriends] = useState<DeviceProfile[]>([]);
  const [query, setQuery] = useState(
    initialCode.length === 6 ? "" : initialCode,
  );
  const [code, setCode] = useState(
    initialCode.length === 6 ? initialCode.slice(0, 6).toUpperCase() : "",
  );
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    if (initialCode.length === 6) {
      setCode(initialCode.slice(0, 6).toUpperCase());
    } else if (initialCode) {
      setQuery(normalizeUsername(initialCode));
    }
  }, [initialCode]);

  const username = auth?.profile?.username;
  const shareUrl = useMemo(() => {
    if (username) return `${SHARE_ORIGIN}/friends?add=${encodeURIComponent(username)}`;
    if (me) return `${SHARE_ORIGIN}/friends?add=${me.code}`;
    return "";
  }, [me, username]);

  async function refresh() {
    const deviceId = getDeviceId();
    const profile = await ensureDeviceProfile(
      deviceId,
      auth?.profile?.username ?? undefined,
    );
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
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.profile?.username]);

  useEffect(() => {
    const q = normalizeUsername(query);
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchProfiles(q, 8)
        .then((rows) =>
          setSuggestions(rows.filter((r) => r.username !== username)),
        )
        .catch(() => setSuggestions([]));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, username]);

  async function copyText(value: string, kind: "code" | "link") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  }

  async function onCopyHandle() {
    if (username) {
      await copyText(username, "code");
      return;
    }
    if (!me) return;
    await copyText(me.code, "code");
  }

  async function onShare() {
    if (!shareUrl) return;
    const label = username ? `@${username}` : me?.code;
    const text = username
      ? `Find me on The Little Things — I'm @${username}. Add me at summer-maps.vercel.app/friends?add=${username}`
      : `Find me on Pathline — my code is ${me?.code}. Add me at summer-maps.vercel.app/friends?add=${me?.code}`;
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
    void label;
    await copyText(shareUrl, "link");
  }

  async function addByUsername(name: string) {
    setSuccess("");
    setError("");
    setAdding(true);
    try {
      await addFriendByUsername(getDeviceId(), name);
      setSuccess("Friend added! Open the map to see their path.");
      setQuery("");
      setSuggestions([]);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not add friend.";
      if (msg.includes("No one found")) {
        setError("That username doesn't match anyone.");
      } else if (msg.includes("already connected")) {
        setError("You're already connected.");
      } else if (msg.includes("yourself")) {
        setError("That's your own username.");
      } else {
        setError(msg);
      }
    } finally {
      setAdding(false);
    }
  }

  async function onAddByUsername(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = normalizeUsername(query);
    if (!trimmed) return;
    await addByUsername(trimmed);
  }

  async function onAddByCode(e: React.FormEvent) {
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
          <p className="friends-label">
            {username ? "Your username" : "Your friend code"}
          </p>
          <div
            className="friends-code-display"
            aria-label={username ? `Username ${username}` : `Friend code ${me.code}`}
          >
            {username ? `@${username}` : me.code}
          </div>
          <div className="friends-hero-actions">
            <button type="button" className="btn primary" onClick={() => void onCopyHandle()}>
              {copied === "code" ? "Copied ✓" : username ? "Copy username" : "Copy code"}
            </button>
            <button type="button" className="btn ghost" onClick={() => void onShare()}>
              Share
            </button>
          </div>
          {shareUrl && (
            <button
              type="button"
              className="friends-link-copy"
              onClick={() => void copyText(shareUrl, "link")}
            >
              <span>Or share this link:</span>
              <em>{shareUrl.replace(/^https?:\/\//, "")}</em>
              <CopyIcon />
              {copied === "link" ? <strong>Copied ✓</strong> : null}
            </button>
          )}
        </section>
      )}

      <section className="friends-section">
        <h2>Add a friend</h2>
        <form className="friends-add-form" onSubmit={(e) => void onAddByUsername(e)}>
          <input
            value={query}
            onChange={(e) =>
              setQuery(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_]/g, "")
                  .slice(0, 20),
              )
            }
            placeholder="Search username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Username"
          />
          <button
            type="submit"
            className="btn primary friends-add-btn"
            disabled={!query.trim() || adding}
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </form>
        {suggestions.length > 0 && (
          <ul className="username-suggestions">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void addByUsername(s.username)}
                  disabled={adding}
                >
                  @{s.username}
                </button>
              </li>
            ))}
          </ul>
        )}
        {success && <p className="status">{success}</p>}
        {error && <p className="status error">{error}</p>}

        <details className="friends-code-fallback">
          <summary>Add with a 6-character code instead</summary>
          <form className="friends-add-form" onSubmit={(e) => void onAddByCode(e)}>
            <input
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6),
                )
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
        </details>
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
            <p className="meta">Share your username to get started.</p>
          </div>
        ) : (
          <ul className="friends-contact-list">
            {friends.map((f) => (
              <li key={f.device_id}>
                <a className="friends-contact-row" href="/map?layer=friends">
                  <span
                    className="friends-color-dot"
                    style={{ background: colorForDevice(f.device_id) }}
                  />
                  <span className="friends-contact-name">
                    {f.display_name?.trim()
                      ? `@${f.display_name.trim()}`
                      : f.code}
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
        <a className="btn primary friends-map-cta" href="/map?layer=friends">
          Open friends map
        </a>
      )}

      <DemoSeedButton onLoaded={() => void refresh()} />
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
