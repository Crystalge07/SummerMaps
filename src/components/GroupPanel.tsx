"use client";

import { useEffect, useState } from "react";
import {
  createGroup,
  getGroupByCode,
  getGroupById,
  joinGroup,
  storageMode,
} from "@/lib/api";
import {
  getActiveGroupId,
  getDeviceId,
  setActiveGroupId,
} from "@/lib/device";
import type { Group } from "@/lib/types";

export function GroupPanel() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [active, setActive] = useState<Group | null>(null);
  const [message, setMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const id = getActiveGroupId();
    if (!id) return;
    getGroupById(id).then((g) => {
      if (g) {
        setActive(g);
        setShareUrl(`${window.location.origin}/group?code=${g.code}`);
      }
    });
  }, []);

  async function onCreate() {
    try {
      const group = await createGroup(name.trim() || "Our circle");
      await joinGroup(group.id, getDeviceId());
      setActiveGroupId(group.id);
      setActive(group);
      setShareUrl(`${window.location.origin}/group?code=${group.code}`);
      setMessage("Circle created. Share the code with friends.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create group.");
    }
  }

  async function onJoin(code?: string) {
    try {
      const group = await getGroupByCode((code ?? joinCode).trim());
      if (!group) {
        setMessage("No circle found for that code.");
        return;
      }
      await joinGroup(group.id, getDeviceId());
      setActiveGroupId(group.id);
      setActive(group);
      setShareUrl(`${window.location.origin}/group?code=${group.code}`);
      setMessage(`Joined ${group.name}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not join group.");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setJoinCode(code);
      onJoin(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="panel">
      <div className="panel-kicker">Anonymous device ID · no accounts</div>
      <h1>Friend circle</h1>
      <p className="lede">
        Create a shareable code. Joining just tags your device with the circle —
        no names required.
      </p>

      {active ? (
        <div className="group-active">
          <h2>{active.name}</h2>
          <p className="code">{active.code}</p>
          <p className="meta">Share link</p>
          <code className="share">{shareUrl}</code>
          <a className="btn primary" href={`/group/map?id=${active.id}`}>
            Open group map
          </a>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setActiveGroupId(null);
              setActive(null);
              setMessage("Left active circle on this device.");
            }}
          >
            Clear active circle
          </button>
        </div>
      ) : (
        <div className="group-forms">
          <label className="field">
            <span>Create a circle</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekend wanderers"
            />
          </label>
          <button type="button" className="btn primary" onClick={onCreate}>
            Create + join
          </button>

          <div className="divider">or</div>

          <label className="field">
            <span>Join with code</span>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
            />
          </label>
          <button type="button" className="btn ghost" onClick={() => onJoin()}>
            Join circle
          </button>
        </div>
      )}

      {message && <p className="status">{message}</p>}
      <p className="meta">Storage: {storageMode()}</p>
    </div>
  );
}
