"use client";

import { useEffect, useState } from "react";
import { getTodayCheckinsForDevice, groupCheckinsIntoPaths } from "@/lib/api";
import { colorForDevice } from "@/lib/colors";
import { getDeviceId } from "@/lib/device";
import type { CheckIn } from "@/lib/types";
import { CheckInDetail } from "./CheckInDetail";
import { Legend } from "./Legend";
import { PathMap } from "./PathMap";
import { PathReplayControls } from "./PathReplayControls";

export function PersonalPathView() {
  const [paths, setPaths] = useState(groupCheckinsIntoPaths([]));
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [progress, setProgress] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const deviceId = getDeviceId();
    getTodayCheckinsForDevice(deviceId)
      .then((rows) => {
        setPaths([
          {
            deviceId,
            color: colorForDevice(deviceId),
            label: "Your day",
            checkins: rows,
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="map-page">
      <div className="map-sidebar">
        <div className="panel-kicker">Today</div>
        <h1>Your path</h1>
        <p className="lede">
          Every check-in connects in time order — a line through your day.
        </p>
        {loading ? (
          <p className="meta">Loading…</p>
        ) : (
          <Legend paths={paths} />
        )}
        <PathReplayControls enabled={paths[0]?.checkins.length > 1} onProgress={setProgress} />
        <CheckInDetail checkIn={selected} />
        <a className="btn primary" href="/check-in">
          Add a check-in
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
