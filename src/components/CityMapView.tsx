"use client";

import { useEffect, useState } from "react";
import { getTodayCityCheckins, groupCheckinsIntoPaths } from "@/lib/api";
import type { CheckIn, PathSeries } from "@/lib/types";
import { CheckInDetail } from "./CheckInDetail";
import { Legend } from "./Legend";
import { PathMap } from "./PathMap";
import { PathReplayControls } from "./PathReplayControls";

export function CityMapView() {
  const [paths, setPaths] = useState<PathSeries[]>([]);
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    getTodayCityCheckins().then((rows) => {
      // Strip identity for public layer labels.
      const series = groupCheckinsIntoPaths(rows, undefined, true).map(
        (p, idx) => ({
          ...p,
          label: `City path ${idx + 1}`,
          deviceId: `anon-${idx + 1}`,
        }),
      );
      setPaths(series);
    });
  }, []);

  return (
    <div className="map-page">
      <div className="map-sidebar">
        <div className="panel-kicker">Public · no login</div>
        <h1>City layer</h1>
        <p className="lede">
          Every check-in today as anonymized lines — the shape of the city&apos;s
          movement, not your friends&apos; names.
        </p>
        <Legend paths={paths} />
        <PathReplayControls
          enabled={paths.some((p) => p.checkins.length > 1)}
          onProgress={setProgress}
        />
        <CheckInDetail checkIn={selected} anonymize />
      </div>
      <PathMap
        paths={paths}
        replayProgress={progress}
        anonymizePhotos
        onSelectCheckIn={setSelected}
      />
    </div>
  );
}
