"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addFriend,
  ensureDeviceProfile,
  getFriendDeviceIds,
  getProfileByCode,
  getProfileByDevice,
} from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import type { DeviceProfile } from "@/lib/types";
import { DemoSeedButton } from "./DemoSeedButton";

const SHARE_ORIGIN = "https://summer-maps.vercel.app";

export function FriendsPanel({ initialCode = "" }: { initialCode?: string }) {
  const [me, setMe] = useState<DeviceProfile | null>(null);
  const [friends, setFriends] = useState<DeviceProfile[]>([]);
  const [code, setCode] = useState(initialCode);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    if (initialCode) setCode(initialCode);
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
    const text = `Join me on Pathline! Add my code: ${me.code} at summer-maps.vercel.app/friends`;
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
    await copyText(me.code, "code");
  }

  async function onAddFriend(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addFriend(getDeviceId(), code.trim());
      const profile = await getProfileByCode(code.trim());
      setMessage(
        profile
          ? `Added friend ${profile.code}. You can see each other's paths.`
          : "Friend added.",
      );
      setCode("");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add friend.");
    }
  }

  return (
    <div className="panel friends-panel">
      <div className="friends-intro">
        <div className="panel-kicker">Little paths</div>
        <h1>Friends</h1>
        <p className="lede">
          Share your code with people you trust. Friends see each other&apos;s
          day as a connected path — strangers on the city map only see loose
          finds.
        </p>
      </div>

      <div className="friends-grid">
        {me && (
          <div className="group-active">
            <p className="meta">Your friend code</p>
            <div
              className="friend-code-box"
              aria-label={`Friend code ${me.code}`}
            >
              {me.code}
            </div>
            <div className="actions">
              <button type="button" className="btn primary" onClick={onCopyCode}>
                {copied === "code" ? "Copied!" : "Copy code"}
              </button>
              <button type="button" className="btn ghost" onClick={onShare}>
                Share
              </button>
            </div>
            <label className="field share-link-field">
              <span>Share link</span>
              <div className="share-link-row">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => copyText(shareUrl, "link")}
                >
                  {copied === "link" ? "Copied!" : "Copy link"}
                </button>
              </div>
            </label>
            <a className="btn primary" href="/friends/map">
              Open friends map
            </a>
          </div>
        )}

        <form className="group-forms" onSubmit={onAddFriend}>
          <label className="field">
            <span>Add a friend by code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
            />
          </label>
          <button type="submit" className="btn primary" disabled={!code.trim()}>
            Add friend
          </button>
        </form>
      </div>

      {friends.length > 0 && (
        <ul className="fallback-paths friends-list">
          {friends.map((f) => (
            <li key={f.device_id}>
              <strong>{f.code}</strong>
              {f.display_name ? ` · ${f.display_name}` : ""}
            </li>
          ))}
        </ul>
      )}

      {message && <p className="status">{message}</p>}
      <DemoSeedButton onLoaded={refresh} />
    </div>
  );
}
