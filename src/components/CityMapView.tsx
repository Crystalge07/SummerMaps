"use client";

import { useEffect, useState } from "react";
import { checkinsAsUnlinkedPins, getTodayCityCheckins } from "@/lib/api";
import { getTodaysPrompt } from "@/lib/prompts";
import type { CheckIn, PathSeries } from "@/lib/types";
import { CheckInDetail } from "./CheckInDetail";
import { PathMap } from "./PathMap";

export function CityMapView() {
  const [pins, setPins] = useState<PathSeries[]>([]);
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const prompt = getTodaysPrompt();

  useEffect(() => {
    getTodayCityCheckins().then((rows) => {
      setPins(checkinsAsUnlinkedPins(rows));
    });
  }, []);

  return (
    <div className="map-page">
      <div className="map-sidebar">
        <div className="panel-kicker">Public · strangers</div>
        <h1>City finds</h1>
        <p className="lede">
          Today&apos;s prompt is <strong>{prompt}</strong>. Every find is a
          single pin — no paths, no names. You can&apos;t tell which photos
          came from the same stranger.
        </p>
        <p className="meta">{pins.length} finds on the map</p>
        <CheckInDetail checkIn={selected} anonymize />
      </div>
      <PathMap
        paths={pins}
        onSelectCheckIn={setSelected}
      />
    </div>
  );
}
