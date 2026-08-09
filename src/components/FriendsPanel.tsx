"use client";

import { useEffect, useMemo, useState } from "react";
import {
  acceptFriendRequest,
  declineFriendRequest,
  ensureDeviceProfile,
  getFriendDeviceIds,
  getIncomingFriendRequests,
  getProfileByDeviceId,
  removeFriend,
  searchProfiles,
  sendFriendRequestByUsername,
} from "@/lib/api";
import { useAuthOptional } from "@/lib/auth";
import { colorForDevice } from "@/lib/colors";
import { getDeviceId } from "@/lib/device";
import type { DeviceProfile, FriendRequest, Profile } from "@/lib/types";
import { normalizeUsername } from "@/lib/username";
import { DemoSeedButton } from "./DemoSeedButton";

const SHARE_ORIGIN = "https://summer-maps.vercel.app";

function friendLabel(friend: DeviceProfile): string {
  const name = friend.display_name?.trim();
  return name ? `@${name}` : "Friend";
}

type IncomingRequest = FriendRequest & { from: DeviceProfile };

export function FriendsPanel({ initialCode = "" }: { initialCode?: string }) {
  const auth = useAuthOptional();
  const [me, setMe] = useState<DeviceProfile | null>(null);
  const [friends, setFriends] = useState<DeviceProfile[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [query, setQuery] = useState(() =>
    initialCode.length === 6 ? "" : normalizeUsername(initialCode),
  );
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"username" | "link" | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialCode || initialCode.length === 6) return;
    setQuery(normalizeUsername(initialCode));
  }, [initialCode]);

  const username = auth?.profile?.username;
  const shareUrl = useMemo(() => {
    if (!username) return "";
    return `${SHARE_ORIGIN}/friends?add=${encodeURIComponent(username)}`;
  }, [username]);

  function myId() {
    return auth?.user?.id || getDeviceId();
  }

  async function hydrateProfile(id: string): Promise<DeviceProfile> {
    const existing = await getProfileByDeviceId(id);
    if (existing) return existing;
    return {
      device_id: id,
      code: "",
      display_name: null,
      created_at: new Date(0).toISOString(),
    };
  }

  async function refresh() {
    const deviceId = myId();
    if (!deviceId) return;

    const profile = await ensureDeviceProfile(
      deviceId,
      auth?.profile?.username ?? undefined,
    );
    setMe(profile);

    const [ids, requests] = await Promise.all([
      getFriendDeviceIds(deviceId),
      getIncomingFriendRequests(deviceId),
    ]);
    const profiles = await Promise.all(ids.map((id) => hydrateProfile(id)));
    setFriends(profiles);

    const incomingRows = await Promise.all(
      requests.map(async (request) => ({
        ...request,
        from: await hydrateProfile(request.from_device_id),
      })),
    );
    setIncoming(incomingRows);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.user?.id, auth?.profile?.username]);

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

  async function copyText(value: string, kind: "username" | "link") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  }

  async function onCopyHandle() {
    if (!username) return;
    await copyText(username, "username");
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

  async function requestByUsername(name: string) {
    const deviceId = myId();
    if (!deviceId) {
      setError("Sign in to send friend requests.");
      return;
    }
    setSuccess("");
    setError("");
    setAdding(true);
    try {
      const result = await sendFriendRequestByUsername(deviceId, name);
      setSuccess(
        result === "accepted"
          ? "You're connected! Open the map to see their path."
          : "Request sent — they'll see it under Incoming friend requests.",
      );
      setQuery("");
      setSuggestions([]);
      await refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not send request.";
      if (msg.includes("No one found")) {
        setError("That username doesn't match anyone.");
      } else if (msg.includes("already connected")) {
        setError("You're already connected.");
      } else if (msg.includes("already sent")) {
        setError("You already sent them a request.");
      } else if (msg.includes("yourself")) {
        setError("That's your own username.");
      } else if (
        /friend_requests|schema cache|does not exist|relation/i.test(msg)
      ) {
        setError(
          "Friend requests aren't set up yet — run the latest supabase/schema.sql in the SQL editor.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setAdding(false);
    }
  }

  async function onRequestByUsername(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = normalizeUsername(query);
    if (!trimmed) return;
    await requestByUsername(trimmed);
  }

  async function onAcceptRequest(request: IncomingRequest) {
    const deviceId = myId();
    if (!deviceId) return;
    setActingRequestId(request.id);
    setError("");
    try {
      await acceptFriendRequest(deviceId, request.id);
      setSuccess(`You're now friends with ${friendLabel(request.from)}.`);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not accept request.",
      );
    } finally {
      setActingRequestId(null);
    }
  }

  async function onDeclineRequest(request: IncomingRequest) {
    const deviceId = myId();
    if (!deviceId) return;
    setActingRequestId(request.id);
    setError("");
    try {
      await declineFriendRequest(deviceId, request.id);
      setIncoming((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not decline request.",
      );
    } finally {
      setActingRequestId(null);
    }
  }

  async function onConfirmRemove(friend: DeviceProfile) {
    const deviceId = myId();
    if (!deviceId) return;
    setRemovingId(friend.device_id);
    setError("");
    try {
      await removeFriend(deviceId, friend.device_id);
      setFriends((prev) => prev.filter((f) => f.device_id !== friend.device_id));
      setConfirmRemoveId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove friend.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="profile-page friends-page">
      {me && (
        <section className="profile-block profile-share-block">
          <p className="panel-kicker">Your username</p>
          {username ? (
            <>
              <p className="profile-handle" aria-label={`Username ${username}`}>
                @{username}
              </p>
              <div className="profile-share-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void onCopyHandle()}
                >
                  {copied === "username" ? "Copied" : "Copy username"}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void onShare()}
                >
                  <ShareIcon /> Share
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
                  {copied === "link" ? <strong>Copied</strong> : null}
                </button>
              )}
            </>
          ) : (
            <p className="meta">
              Pick a username on Profile to share yourself with friends.
            </p>
          )}
        </section>
      )}

      <section className="profile-block">
        <h2>Add a friend</h2>
        <form
          className="friends-add-form"
          onSubmit={(e) => void onRequestByUsername(e)}
        >
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
            {adding ? "Sending…" : "Send request"}
          </button>
        </form>
        {suggestions.length > 0 && (
          <ul className="username-suggestions">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void requestByUsername(s.username)}
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
      </section>

      <section className="profile-block">
        <h2>
          Incoming friend requests{" "}
          <span className="friends-count">{incoming.length}</span>
        </h2>
        {incoming.length === 0 ? (
          <p className="meta">No pending requests.</p>
        ) : (
          <ul className="friends-request-list">
            {incoming.map((request) => {
              const label = friendLabel(request.from);
              const busy = actingRequestId === request.id;
              return (
                <li key={request.id} className="friends-request-row">
                  <span
                    className="friends-color-dot"
                    style={{
                      background: colorForDevice(request.from_device_id),
                    }}
                  />
                  <span className="friends-contact-name">{label}</span>
                  <div className="friends-request-actions">
                    <button
                      type="button"
                      className="friends-request-accept"
                      aria-label={`Accept ${label}`}
                      disabled={busy}
                      onClick={() => void onAcceptRequest(request)}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="friends-request-decline"
                      aria-label={`Decline ${label}`}
                      disabled={busy}
                      onClick={() => void onDeclineRequest(request)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="profile-block">
        <h2>
          Your circle <span className="friends-count">{friends.length}</span>
        </h2>

        {friends.length === 0 ? (
          <div className="friends-empty">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/path-mark.svg" alt="" width={56} height={56} />
            <p>Two paths that haven&apos;t connected yet.</p>
            <p className="meta">Share your username to find each other.</p>
          </div>
        ) : (
          <ul className="friends-contact-list">
            {friends.map((f) => {
              const label = friendLabel(f);
              const confirming = confirmRemoveId === f.device_id;
              const busy = removingId === f.device_id;
              return (
                <li key={f.device_id}>
                  {confirming ? (
                    <div className="friends-contact-confirm">
                      <span>Remove {label} from your circle?</span>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn danger"
                          disabled={busy}
                          onClick={() => void onConfirmRemove(f)}
                        >
                          {busy ? "Removing…" : "Confirm"}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={busy}
                          onClick={() => setConfirmRemoveId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="friends-contact-row">
                      <a
                        className="friends-contact-main"
                        href="/map?layer=friends"
                      >
                        <span
                          className="friends-color-dot"
                          style={{ background: colorForDevice(f.device_id) }}
                        />
                        <span className="friends-contact-name">{label}</span>
                      </a>
                      <button
                        type="button"
                        className="friends-contact-remove"
                        aria-label={`Remove ${label}`}
                        onClick={() => setConfirmRemoveId(f.device_id)}
                      >
                        ×
                      </button>
                      <a
                        className="friends-contact-go"
                        href="/map?layer=friends"
                        aria-label={`Open map with ${label}`}
                      >
                        on the map →
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
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

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="18" cy="5" r="2.75" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="6" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="18" cy="19" r="2.75" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.4 10.6l7.2-4.2M8.4 13.4l7.2 4.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
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
