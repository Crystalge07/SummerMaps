"use client";

import { useEffect, useState } from "react";
import {
  addFriend,
  ensureDeviceProfile,
  getFriendDeviceIds,
  getProfileByCode,
} from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import type { DeviceProfile } from "@/lib/types";
import { DemoSeedButton } from "./DemoSeedButton";

export function FriendsPanel({ initialCode = "" }: { initialCode?: string }) {
  const [me, setMe] = useState<DeviceProfile | null>(null);
  const [friends, setFriends] = useState<DeviceProfile[]>([]);
  const [code, setCode] = useState(initialCode);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initialCode) setCode(initialCode);
  }, [initialCode]);

  async function refresh() {
    const deviceId = getDeviceId();
    const profile = await ensureDeviceProfile(deviceId);
    setMe(profile);
    const ids = await getFriendDeviceIds(deviceId);
    const profiles = await Promise.all(
      ids.map(async (id) => ensureDeviceProfile(id)),
    );
    setFriends(profiles);
  }

  useEffect(() => {
    refresh();
  }, []);

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
            <p>
              Your friend code: <strong className="code">{me.code}</strong>
            </p>
            <p className="meta">
              Share <code>/friends?code={me.code}</code>
            </p>
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
