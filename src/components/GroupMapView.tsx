"use client";

import { useEffect, useState } from "react";
import {
  getGroupById,
  getGroupMembers,
  getTodayCheckinsForGroup,
  groupCheckinsIntoPaths,
} from "@/lib/api";
import { detectCrossings, type PathCrossing } from "@/lib/crossings";
import { getActiveGroupId } from "@/lib/device";
import type { CheckIn, Group, PathSeries } from "@/lib/types";
import { CheckInDetail } from "./CheckInDetail";
import { Legend } from "./Legend";
import { PathMap } from "./PathMap";
import { PathReplayControls } from "./PathReplayControls";

export function GroupMapView({ groupId }: { groupId?: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [paths, setPaths] = useState<PathSeries[]>([]);
  const [crossings, setCrossings] = useState<PathCrossing[]>([]);
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [progress, setProgress] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = groupId || getActiveGroupId();
    if (!id) {
      setError("Join or create a circle first.");
      return;
    }

    (async () => {
      const g = await getGroupById(id);
      if (!g) {
        setError("Circle not found.");
        return;
      }
      setGroup(g);
      const [members, checkins] = await Promise.all([
        getGroupMembers(id),
        getTodayCheckinsForGroup(id),
      ]);
      const series = groupCheckinsIntoPaths(checkins, members);
      setPaths(series);
      setCrossings(detectCrossings(series));
    })().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load group."),
    );
  }, [groupId]);

  return (
    <div className="map-page">
      <div className="map-sidebar">
        <div className="panel-kicker">Shared day</div>
        <h1>{group?.name ?? "Circle map"}</h1>
        <p className="lede">
          Each person is a color. Watch days cross — or miss — on one map.
        </p>
        {error && <p className="status error">{error}</p>}
        <Legend paths={paths} />
        {crossings.length > 0 && (
          <p className="meta">{crossings.length} near-miss crossings today</p>
        )}
        <PathReplayControls
          enabled={paths.some((p) => p.checkins.length > 1)}
          onProgress={setProgress}
        />
        <CheckInDetail checkIn={selected} />
      </div>
      <PathMap
        paths={paths}
        crossings={crossings}
        replayProgress={progress}
        onSelectCheckIn={setSelected}
      />
    </div>
  );
}
