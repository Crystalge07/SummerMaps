"use client";

import { useEffect, useState } from "react";
import { getTodayCheckinsForDevice } from "@/lib/api";
import { colorForDevice } from "@/lib/colors";
import { getDeviceId } from "@/lib/device";
import { getTodaysPrompt } from "@/lib/prompts";
import type { CheckIn, PathSeries } from "@/lib/types";
import { CheckInDetail } from "./CheckInDetail";
import { Legend } from "./Legend";
import { PathMap } from "./PathMap";
import { PathReplayControls } from "./PathReplayControls";

export function PersonalPathView() {
  const [paths, setPaths] = useState<PathSeries[]>([]);
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [progress, setProgress] = useState(1);
  const [loading, setLoading] = useState(true);
  const prompt = getTodaysPrompt();

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
            connect: true,
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="map-page has-atmosphere">
      <div className="map-sidebar">
        <div className="illus-strip" aria-hidden />
        <div className="panel-kicker">Today · {prompt}</div>
        <h1>Your path</h1>
        <p className="lede">
          Your finds for <em>{prompt}</em> connect in time order — a line
          through your day.
        </p>
        {loading ? (
          <p className="meta">Loading…</p>
        ) : (
          <Legend paths={paths} />
        )}
        <PathReplayControls
          enabled={(paths[0]?.checkins.length ?? 0) > 1}
          onProgress={setProgress}
        />
        <CheckInDetail checkIn={selected} />
        <a className="btn primary" href="/check-in">
          Add a find
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
