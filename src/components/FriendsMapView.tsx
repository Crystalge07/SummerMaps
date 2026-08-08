"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ensureDeviceProfile,
  getFriendDeviceIds,
  getProfileByDevice,
  getTodayCheckinsForDevices,
  storageMode,
} from "@/lib/api";
import { colorForDevice } from "@/lib/colors";
import { getDeviceId } from "@/lib/device";
import { friendCodeFromDeviceId } from "@/lib/friendCode";
import { getTodaysPrompt } from "@/lib/prompts";
import type { CheckIn, PathSeries } from "@/lib/types";
import { CheckInDetail } from "./CheckInDetail";
import { Legend } from "./Legend";
import { PathMap } from "./PathMap";
import { PathReplayControls } from "./PathReplayControls";

export function FriendsMapView() {
  const [paths, setPaths] = useState<PathSeries[]>([]);
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [progress, setProgress] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const prompt = getTodaysPrompt();

  const loadPaths = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = getDeviceId();
      if (!me) {
        setPaths([]);
        setError("Device id not ready yet — refresh and try again.");
        return;
      }

      // Ensure this device has a profile so friendships resolve in Supabase.
      await ensureDeviceProfile(me);
      const friendIds = await getFriendDeviceIds(me);
      const deviceIds = [me, ...friendIds];
      const checkins = await getTodayCheckinsForDevices(deviceIds);

      const byDevice = new Map<string, CheckIn[]>();
      for (const c of checkins) {
        const list = byDevice.get(c.device_id) ?? [];
        list.push(c);
        byDevice.set(c.device_id, list);
      }

      const series: PathSeries[] = await Promise.all(
        deviceIds.map(async (deviceId, index) => {
          const profile = await getProfileByDevice(deviceId);
          const code =
            profile?.code ?? friendCodeFromDeviceId(deviceId);
          const name = profile?.display_name?.trim();
          const handle = name ? `@${name}` : code;
          const label = deviceId === me ? `You · ${handle}` : handle;
          const rows = (byDevice.get(deviceId) ?? []).sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          );
          return {
            deviceId,
            color: colorForDevice(deviceId, index),
            label,
            checkins: rows,
            connect: true,
          };
        }),
      );

      setPaths(series);
      setProgress(1);

      if (friendIds.length === 0) {
        setError("Add friends (or load demo paths) to see shared paths.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load friends.");
      setPaths([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPaths();
  }, [loadPaths]);

  return (
    <div className="map-page">
      <div className="map-sidebar">
        <div className="panel-kicker">today · {prompt}</div>
        <h1>Friends&apos; paths</h1>
        <p className="lede">
          Lines connect each friend&apos;s finds in time order — a rough sense
          of where they went while hunting the prompt.
        </p>
        <p className="meta">
          Storage: {storageMode() === "supabase" ? "Supabase" : "local demo"}
        </p>
        {loading && <p className="meta">Loading paths…</p>}
        {error && <p className="status error">{error}</p>}
        <Legend paths={paths} />
        <PathReplayControls
          enabled={paths.some((p) => p.checkins.length > 1)}
          onProgress={setProgress}
        />
        <CheckInDetail checkIn={selected} />
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => loadPaths()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <a className="btn ghost" href="/friends">
            Manage friends
          </a>
        </div>
      </div>
      <PathMap
        paths={paths}
        replayProgress={progress}
        onSelectCheckIn={setSelected}
      />
    </div>
  );
}
