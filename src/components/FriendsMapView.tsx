"use client";

import { useEffect, useState } from "react";
import {
  getFriendDeviceIds,
  getTodayCheckinsForDevices,
  groupCheckinsIntoPaths,
} from "@/lib/api";
import { getDeviceId } from "@/lib/device";
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
  const prompt = getTodaysPrompt();

  useEffect(() => {
    const me = getDeviceId();
    getFriendDeviceIds(me)
      .then(async (friendIds) => {
        const deviceIds = [me, ...friendIds];
        const checkins = await getTodayCheckinsForDevices(deviceIds);
        const labels = new Map<string, string>();
        labels.set(me, "You");
        friendIds.forEach((id, idx) => labels.set(id, `Friend ${idx + 1}`));
        setPaths(groupCheckinsIntoPaths(checkins, labels));
        if (friendIds.length === 0 && checkins.length === 0) {
          setError("Add friends (or load demo paths) to see shared paths.");
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load friends."),
      );
  }, []);

  return (
    <div className="map-page">
      <div className="map-sidebar">
        <div className="panel-kicker">Today · {prompt}</div>
        <h1>Friends&apos; paths</h1>
        <p className="lede">
          Lines connect each friend&apos;s finds in time order — a rough sense
          of where they went while hunting the prompt.
        </p>
        {error && <p className="status error">{error}</p>}
        <Legend paths={paths} />
        <PathReplayControls
          enabled={paths.some((p) => p.checkins.length > 1)}
          onProgress={setProgress}
        />
        <CheckInDetail checkIn={selected} />
        <a className="btn ghost" href="/friends">
          Manage friends
        </a>
      </div>
      <PathMap
        paths={paths}
        replayProgress={progress}
        onSelectCheckIn={setSelected}
      />
    </div>
  );
}
