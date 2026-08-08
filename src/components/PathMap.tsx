"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import Map, { Layer, Marker, NavigationControl, Source } from "react-map-gl/mapbox";
import type { PathCrossing } from "@/lib/crossings";
import { CITY_CENTER } from "@/lib/geo";
import type { CheckIn, PathSeries } from "@/lib/types";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapViewMode = "lines" | "heatmap";
export type MapFocus = "all" | "checkins" | "paths" | "crossings";

type Props = {
  paths: PathSeries[];
  crossings?: PathCrossing[];
  replayProgress?: number; // 0–1
  anonymizePhotos?: boolean;
  onSelectCheckIn?: (checkIn: CheckIn) => void;
  viewMode?: MapViewMode;
  focus?: MapFocus;
  initialCenter?: { lat: number; lng: number };
};

function slicePath(checkins: CheckIn[], progress: number) {
  if (checkins.length === 0) return checkins;
  if (progress >= 1) return checkins;
  if (progress <= 0) return checkins.slice(0, 1);
  const count = Math.max(1, Math.ceil(checkins.length * progress));
  return checkins.slice(0, count);
}

export function PathMap({
  paths,
  crossings = [],
  replayProgress = 1,
  anonymizePhotos = false,
  onSelectCheckIn,
  viewMode = "lines",
  focus = "all",
  initialCenter,
}: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const visiblePaths = useMemo(
    () =>
      paths.map((p) => ({
        ...p,
        checkins: slicePath(p.checkins, replayProgress),
      })),
    [paths, replayProgress],
  );

  const allPoints = visiblePaths.flatMap((p) => p.checkins);
  const center = initialCenter
    ? initialCenter
    : allPoints[0]
      ? { lat: allPoints[0].lat, lng: allPoints[0].lng }
      : CITY_CENTER;

  const heatmapData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: allPoints.map((c) => ({
        type: "Feature" as const,
        properties: { weight: 1 },
        geometry: {
          type: "Point" as const,
          coordinates: [c.lng, c.lat],
        },
      })),
    }),
    [allPoints],
  );

  const showLines =
    viewMode === "lines" && focus !== "checkins" && focus !== "crossings";
  const showMarkers =
    viewMode === "lines" && focus !== "paths" && focus !== "crossings";
  const showCrossings =
    focus === "crossings" || (focus === "all" && crossings.length > 0);
  const lineOpacity = focus === "crossings" ? 0.25 : 0.9;

  if (!token) {
    return (
      <div className="map-fallback">
        <p>
          Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to see live Mapbox paths.
        </p>
        <FallbackList paths={visiblePaths} />
      </div>
    );
  }

  return (
    <div className="map-shell">
      <Map
        mapboxAccessToken={token}
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom: 12.5,
        }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />

        {viewMode === "heatmap" && (
          <Source id="city-heatmap" type="geojson" data={heatmapData}>
            <Layer
              id="city-heatmap-layer"
              type="heatmap"
              paint={{
                "heatmap-weight": [
                  "interpolate",
                  ["linear"],
                  ["get", "weight"],
                  0,
                  0,
                  1,
                  1,
                ],
                "heatmap-intensity": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  0,
                  1,
                  9,
                  3,
                  14,
                  4,
                ],
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0,
                  "rgba(33,102,172,0)",
                  0.2,
                  "rgb(103,169,207)",
                  0.4,
                  "rgb(209,229,240)",
                  0.6,
                  "rgb(253,219,199)",
                  0.8,
                  "rgb(239,138,98)",
                  1,
                  "rgb(178,24,43)",
                ],
                "heatmap-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  0,
                  2,
                  9,
                  20,
                  14,
                  32,
                ],
                "heatmap-opacity": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  7,
                  0.85,
                  15,
                  0.55,
                ],
              }}
            />
          </Source>
        )}

        {showLines &&
          visiblePaths.map((path) => {
            if (path.connect === false) return null;
            if (path.checkins.length < 2) return null;
            const geojson = {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: path.checkins.map((c) => [c.lng, c.lat]),
              },
            };
            return (
              <Source
                key={path.deviceId}
                id={`line-${path.deviceId}`}
                type="geojson"
                data={geojson}
              >
                <Layer
                  id={`line-layer-${path.deviceId}`}
                  type="line"
                  paint={{
                    "line-color": path.color,
                    "line-width": 4,
                    "line-opacity": lineOpacity,
                  }}
                  layout={{
                    "line-cap": "round",
                    "line-join": "round",
                  }}
                />
              </Source>
            );
          })}

        {showMarkers &&
          visiblePaths.flatMap((path) =>
            path.checkins.map((c) => (
              <Marker
                key={c.id}
                latitude={c.lat}
                longitude={c.lng}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  onSelectCheckIn?.(c);
                }}
              >
                <button
                  type="button"
                  className="map-pin"
                  style={{ ["--pin-accent" as string]: path.color }}
                  title={format(new Date(c.created_at), "h:mm a")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/pin.svg"
                    alt=""
                    className="map-pin-illus"
                  />
                  {!anonymizePhotos && c.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.photo_url}
                      alt=""
                      className="map-pin-photo"
                    />
                  ) : (
                    <span
                      className="map-pin-dot"
                      style={{ background: path.color }}
                    />
                  )}
                </button>
              </Marker>
            )),
          )}

        {showCrossings &&
          crossings.map((x, idx) => (
            <Marker
              key={`${x.aDeviceId}-${x.bDeviceId}-${idx}`}
              latitude={x.lat}
              longitude={x.lng}
            >
              <div
                className={`crossing-dot${focus === "crossings" ? " crossing-dot-focus" : ""}`}
                title="Paths crossed here"
              />
            </Marker>
          ))}
      </Map>
    </div>
  );
}

function FallbackList({ paths }: { paths: PathSeries[] }) {
  return (
    <ul className="fallback-paths">
      {paths.map((p) => (
        <li key={p.deviceId}>
          <span className="swatch" style={{ background: p.color }} />
          {p.label}: {p.checkins.length}{" "}
          {p.connect === false ? "find" : "check-ins"}
          {p.connect !== false && (
            <ol>
              {p.checkins.map((c) => (
                <li key={c.id}>
                  {format(new Date(c.created_at), "h:mm a")} ·{" "}
                  {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                  {c.caption ? ` — ${c.caption}` : ""}
                </li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ul>
  );
}
