"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import Map, { Layer, Marker, NavigationControl, Source } from "react-map-gl/mapbox";
import type { PathCrossing } from "@/lib/crossings";
import { CITY_CENTER } from "@/lib/geo";
import type { CheckIn, PathSeries } from "@/lib/types";
import "mapbox-gl/dist/mapbox-gl.css";

type Props = {
  paths: PathSeries[];
  crossings?: PathCrossing[];
  replayProgress?: number; // 0–1
  anonymizePhotos?: boolean;
  onSelectCheckIn?: (checkIn: CheckIn) => void;
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
  const center = allPoints[0]
    ? { lat: allPoints[0].lat, lng: allPoints[0].lng }
    : CITY_CENTER;

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

        {visiblePaths.map((path) => {
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
            <Source key={path.deviceId} id={`line-${path.deviceId}`} type="geojson" data={geojson}>
              <Layer
                id={`line-layer-${path.deviceId}`}
                type="line"
                paint={{
                  "line-color": path.color,
                  "line-width": 4,
                  "line-opacity": 0.9,
                }}
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
              />
            </Source>
          );
        })}

        {visiblePaths.flatMap((path) =>
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
                className="pin"
                style={{ borderColor: path.color }}
                title={format(new Date(c.created_at), "h:mm a")}
              >
                {!anonymizePhotos && c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo_url} alt="" />
                ) : (
                  <span style={{ background: path.color }} />
                )}
              </button>
            </Marker>
          )),
        )}

        {crossings.map((x, idx) => (
          <Marker
            key={`${x.aDeviceId}-${x.bDeviceId}-${idx}`}
            latitude={x.lat}
            longitude={x.lng}
          >
            <div className="crossing-dot" title="Paths crossed here" />
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
                  {format(new Date(c.created_at), "h:mm a")} · {c.lat.toFixed(4)},{" "}
                  {c.lng.toFixed(4)}
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
