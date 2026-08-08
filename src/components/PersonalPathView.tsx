"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { deleteCheckIn, getTodayCheckinsForDevice } from "@/lib/api";
import { colorForDevice } from "@/lib/colors";
import { getDeviceId } from "@/lib/device";
import { getTodaysPrompt } from "@/lib/prompts";
import type { CheckIn, PathSeries } from "@/lib/types";
import { CheckInCard } from "./CheckInCard";
import { Legend } from "./Legend";
import { PathMap } from "./PathMap";
import { PathReplayControls } from "./PathReplayControls";

export function PersonalPathView() {
  const pathname = usePathname();
  const [deviceId, setDeviceId] = useState("");
  const [paths, setPaths] = useState<PathSeries[]>([]);
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [progress, setProgress] = useState(1);
  const [loading, setLoading] = useState(true);
  const prompt = getTodaysPrompt();

  const loadPath = useCallback(async () => {
    const id = getDeviceId();
    if (!id) return;
    setDeviceId(id);
    setLoading(true);
    try {
      // Cache-bust: always hit storage after navigating from a fresh check-in.
      const rows = await getTodayCheckinsForDevice(id);
      setPaths([
        {
          deviceId: id,
          color: colorForDevice(id),
          label: "Your day",
          checkins: rows,
          connect: true,
        },
      ]);
      setProgress(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPath();
  }, [loadPath, pathname]);

  function removeCheckIn(id: string) {
    setPaths((prev) =>
      prev.map((p) => ({
        ...p,
        checkins: p.checkins.filter((c) => c.id !== id),
      })),
    );
    setSelected((cur) => (cur?.id === id ? null : cur));
  }

  const checkins = paths[0]?.checkins ?? [];

  return (
    <div className="map-page">
      <div className="map-sidebar">
        <div className="panel-kicker">today · {prompt}</div>
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
          enabled={checkins.length > 1}
          onProgress={setProgress}
        />

        <div className="checkin-card-list">
          {checkins.length === 0 && !loading && (
            <p className="meta">No finds yet today.</p>
          )}
          {checkins.map((c) => (
            <CheckInCard
              key={c.id}
              checkIn={c}
              canDelete={Boolean(deviceId) && c.device_id === deviceId}
              selected={selected?.id === c.id}
              onSelect={setSelected}
              onDeleted={removeCheckIn}
            />
          ))}
        </div>

        <a className="btn primary" href="/">
          Capture
        </a>
      </div>
      <PathMap
        paths={paths}
        replayProgress={progress}
        onSelectCheckIn={setSelected}
        ownDeviceId={deviceId || undefined}
        onDeleteCheckIn={async (c) => {
          await deleteCheckIn(c.id, c.device_id);
          removeCheckIn(c.id);
        }}
      />
    </div>
  );
}
