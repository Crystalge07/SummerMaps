"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  checkinsAsUnlinkedPins,
  getAllCheckins,
  getTodayCityCheckins,
} from "@/lib/api";
import { getTodaysPrompt } from "@/lib/prompts";
import type { CheckIn, PathSeries } from "@/lib/types";
import { CheckInDetail } from "./CheckInDetail";
import { PathMap, type MapViewMode } from "./PathMap";

function parseView(raw: string | null): MapViewMode {
  return raw === "heatmap" ? "heatmap" : "lines";
}

export function CityMapView() {
  const params = useSearchParams();
  const filterParam = params.get("filter");
  const viewParam = params.get("view");
  const latParam = params.get("lat");
  const lngParam = params.get("lng");

  const [viewMode, setViewMode] = useState<MapViewMode>(() =>
    parseView(viewParam),
  );
  const [pins, setPins] = useState<PathSeries[]>([]);
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const prompt = getTodaysPrompt();

  useEffect(() => {
    setViewMode(parseView(viewParam));
  }, [viewParam]);

  useEffect(() => {
    const load =
      filterParam === "alltime" ? getAllCheckins() : getTodayCityCheckins();
    load.then((rows) => {
      setPins(checkinsAsUnlinkedPins(rows));
    });
  }, [filterParam]);

  const initialCenter = useMemo(() => {
    if (latParam && lngParam) {
      const lat = Number(latParam);
      const lng = Number(lngParam);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    }
    return undefined;
  }, [latParam, lngParam]);

  const focusLabel =
    filterParam === "alltime"
      ? "Showing all-time finds"
      : filterParam === "checkins" || filterParam === "noticers"
        ? "Focusing on today's finds"
        : null;

  return (
    <div className="map-page has-atmosphere">
      <div className="map-sidebar">
        <div className="illus-strip" aria-hidden />
        <div className="panel-kicker">Public · strangers</div>
        <h1>City finds</h1>
        <p className="lede">
          Today&apos;s prompt is <strong>{prompt}</strong>. Every find is a
          single pin — no paths, no names. You can&apos;t tell which photos
          came from the same stranger.
        </p>
        {focusLabel && <p className="meta filter-note">{focusLabel}</p>}
        <p className="meta">{pins.length} finds on the map</p>

        <div className="view-toggle" role="group" aria-label="Map view">
          <button
            type="button"
            className={viewMode === "lines" ? "toggle active" : "toggle"}
            onClick={() => setViewMode("lines")}
          >
            Pins
          </button>
          <button
            type="button"
            className={viewMode === "heatmap" ? "toggle active" : "toggle"}
            onClick={() => setViewMode("heatmap")}
          >
            Heatmap
          </button>
        </div>

        <CheckInDetail checkIn={selected} anonymize />
      </div>
      <PathMap
        paths={pins}
        anonymizePhotos
        onSelectCheckIn={setSelected}
        viewMode={viewMode}
        focus="checkins"
        initialCenter={initialCenter}
      />
    </div>
  );
}
