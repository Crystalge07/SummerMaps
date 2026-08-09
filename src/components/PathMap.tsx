"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import MapboxMap, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
} from "react-map-gl/mapbox";
import type { PathCrossing } from "@/lib/crossings";
import { CITY_CENTER } from "@/lib/geo";
import {
  curvedLineThrough,
  displayCoordsByCheckInId,
} from "@/lib/pathGeometry";
import { displayCreatedAt } from "@/lib/prompts";
import type { CheckIn, PathSeries } from "@/lib/types";
import { PhotoPin } from "./PhotoPin";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapViewMode = "lines" | "heatmap";
export type MapFocus = "all" | "checkins" | "paths" | "crossings";

/** Chronological replay visual state from UnifiedMapView. */
export type PathReplayVisual = {
  active: boolean;
  visiblePinIds: ReadonlySet<string>;
  lineDeviceIds: ReadonlySet<string>;
  drawing: {
    deviceId: string;
    coordinates: [number, number][];
    color: string;
  } | null;
  expandingPinId: string | null;
};

type Props = {
  paths: PathSeries[];
  crossings?: PathCrossing[];
  /** Legacy 0–1 path slice (PersonalPathView / FriendsMapView). */
  replayProgress?: number;
  replayVisual?: PathReplayVisual | null;
  anonymizePhotos?: boolean;
  onSelectCheckIn?: (checkIn: CheckIn | null) => void;
  viewMode?: MapViewMode;
  focus?: MapFocus;
  initialCenter?: { lat: number; lng: number };
  ownDeviceId?: string;
  onDeleteCheckIn?: (checkIn: CheckIn) => Promise<void>;
};

function slicePath(checkins: CheckIn[], progress: number) {
  if (checkins.length === 0) return checkins;
  if (progress >= 1) return checkins;
  if (progress <= 0) return checkins.slice(0, 1);
  const count = Math.max(1, Math.ceil(checkins.length * progress));
  return checkins.slice(0, count);
}

function pathLabelForDevice(
  paths: PathSeries[],
  deviceId: string,
): string | null {
  const path = paths.find((p) => p.deviceId === deviceId);
  if (!path) return null;
  const raw = path.label.replace(/^You ·\s*/, "").trim();
  if (!raw || raw === "You") return null;
  return raw.startsWith("@") ? raw.slice(1) : raw;
}

function crossingFriendName(
  crossing: PathCrossing,
  paths: PathSeries[],
  ownDeviceId?: string,
): string {
  const otherId =
    ownDeviceId &&
    (crossing.aDeviceId === ownDeviceId ||
      crossing.bDeviceId === ownDeviceId)
      ? crossing.aDeviceId === ownDeviceId
        ? crossing.bDeviceId
        : crossing.aDeviceId
      : crossing.bDeviceId;
  return (
    pathLabelForDevice(paths, otherId) ||
    pathLabelForDevice(paths, crossing.aDeviceId) ||
    pathLabelForDevice(paths, crossing.bDeviceId) ||
    "a friend"
  );
}

export function PathMap({
  paths,
  crossings = [],
  replayProgress = 1,
  replayVisual = null,
  anonymizePhotos = false,
  onSelectCheckIn,
  viewMode = "lines",
  focus = "all",
  initialCenter,
  ownDeviceId,
  onDeleteCheckIn,
}: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [popup, setPopup] = useState<CheckIn | null>(null);
  const [crossingPopup, setCrossingPopup] = useState<PathCrossing | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!popup) return;
    const stillThere = paths.some((p) =>
      p.checkins.some((c) => c.id === popup.id),
    );
    if (!stillThere) {
      setPopup(null);
      setConfirmDelete(false);
      setDeleteError("");
    }
  }, [paths, popup]);

  useEffect(() => {
    if (!crossingPopup) return;
    const stillThere = crossings.some(
      (x) =>
        x.aDeviceId === crossingPopup.aDeviceId &&
        x.bDeviceId === crossingPopup.bDeviceId &&
        x.lat === crossingPopup.lat &&
        x.lng === crossingPopup.lng &&
        x.timeA === crossingPopup.timeA,
    );
    if (!stillThere) setCrossingPopup(null);
  }, [crossings, crossingPopup]);

  const displayCoords = useMemo(
    () => displayCoordsByCheckInId(paths),
    [paths],
  );

  const chronologicalMode = Boolean(replayVisual?.active);

  const visiblePaths = useMemo(() => {
    if (chronologicalMode && replayVisual) {
      return paths.map((p) => {
        if (p.connect === false) {
          return {
            ...p,
            checkins: p.checkins.filter((c) =>
              replayVisual.visiblePinIds.has(c.id),
            ),
          };
        }
        const sorted = [...p.checkins].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        );
        return {
          ...p,
          checkins: sorted.filter((c) => replayVisual.visiblePinIds.has(c.id)),
        };
      });
    }
    return paths.map((p) => ({
      ...p,
      checkins: slicePath(
        [...p.checkins].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        ),
        replayProgress,
      ),
    }));
  }, [paths, replayProgress, chronologicalMode, replayVisual]);

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
  // Show whenever parent passes crossings (was gated on focus === "all"|"crossings",
  // which hid dots in city/checkins focus).
  const showCrossings = crossings.length > 0;

  const uniqueMarkers = useMemo(() => {
    const seen = new Set<string>();
    const items: {
      checkIn: CheckIn;
      color: string;
      lat: number;
      lng: number;
      isCityPin: boolean;
    }[] = [];
    const ordered = [
      ...visiblePaths.filter((p) => p.connect !== false),
      ...visiblePaths.filter((p) => p.connect === false),
    ];
    for (const path of ordered) {
      for (const checkIn of path.checkins) {
        if (seen.has(checkIn.id)) continue;
        if (
          chronologicalMode &&
          replayVisual &&
          path.connect !== false &&
          !replayVisual.visiblePinIds.has(checkIn.id)
        ) {
          continue;
        }
        seen.add(checkIn.id);
        const pos = displayCoords.get(checkIn.id) ?? {
          lat: checkIn.lat,
          lng: checkIn.lng,
        };
        items.push({
          checkIn,
          color: path.color,
          lat: pos.lat,
          lng: pos.lng,
          isCityPin: path.connect === false,
        });
      }
    }
    return items;
  }, [visiblePaths, displayCoords, chronologicalMode, replayVisual]);

  const lineOpacity = focus === "crossings" ? 0.25 : 0.9;

  const pathLines = useMemo(() => {
    if (!showLines) return [];
    return visiblePaths
      .filter((path) => path.connect !== false)
      .filter((path) => {
        if (!chronologicalMode || !replayVisual) return true;
        return replayVisual.lineDeviceIds.has(path.deviceId);
      })
      .map((path) => {
        const sorted = [...path.checkins].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        );
        if (sorted.length < 2) return null;
        const stops = sorted.map((c) => {
          const pos = displayCoords.get(c.id) ?? { lat: c.lat, lng: c.lng };
          return [pos.lng, pos.lat] as [number, number];
        });
        return {
          deviceId: path.deviceId,
          color: path.color,
          coordinates: curvedLineThrough(stops),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [
    showLines,
    visiblePaths,
    chronologicalMode,
    replayVisual,
    displayCoords,
  ]);

  const canDeletePopup = Boolean(
    popup && ownDeviceId && popup.device_id === ownDeviceId && onDeleteCheckIn,
  );

  async function confirmPopupDelete() {
    if (!popup || !onDeleteCheckIn) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteCheckIn(popup);
      setPopup(null);
      setConfirmDelete(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

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

  const drawing = replayVisual?.drawing ?? null;

  return (
    <div className="map-shell">
      <MapboxMap
        mapboxAccessToken={token}
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom: 12.5,
        }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
        onClick={() => {
          setPopup(null);
          setCrossingPopup(null);
          setConfirmDelete(false);
          setDeleteError("");
          onSelectCheckIn?.(null);
        }}
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
                  "rgba(74,124,89,0)",
                  0.15,
                  "rgba(201,219,201,0.55)",
                  0.35,
                  "rgb(141,181,150)",
                  0.55,
                  "rgb(232,197,71)",
                  0.75,
                  "rgb(74,124,89)",
                  1,
                  "rgb(44,62,45)",
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

        {pathLines.map((line) => {
          const geojson = {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: line.coordinates,
            },
          };
          return (
            <Source
              key={`line-${line.deviceId}`}
              id={`line-${line.deviceId}`}
              type="geojson"
              data={geojson}
            >
              <Layer
                id={`line-layer-${line.deviceId}`}
                type="line"
                paint={{
                  "line-color": line.color,
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

        {drawing && drawing.coordinates.length >= 2 && (
          <Source
            id="replay-drawing-segment"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: drawing.coordinates,
              },
            }}
          >
            <Layer
              id="replay-drawing-segment-layer"
              type="line"
              paint={{
                "line-color": drawing.color,
                "line-width": 4,
                "line-opacity": lineOpacity,
              }}
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
            />
          </Source>
        )}

        {showMarkers &&
          uniqueMarkers.map(({ checkIn: c, color, lat, lng, isCityPin }) => {
            const isOwn = Boolean(ownDeviceId && c.device_id === ownDeviceId);
            const size = isCityPin ? 32 : isOwn ? 48 : 40;
            const entering =
              chronologicalMode &&
              replayVisual?.expandingPinId === c.id;
            return (
              <Marker
                key={c.id}
                latitude={lat}
                longitude={lng}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  if (
                    ownDeviceId &&
                    c.device_id === ownDeviceId &&
                    onDeleteCheckIn
                  ) {
                    setPopup(c);
                    setConfirmDelete(false);
                    setDeleteError("");
                    return;
                  }
                  onSelectCheckIn?.(c);
                }}
              >
                <button
                  type="button"
                  className={`map-pin${entering ? " pin-entering" : ""}`}
                  style={{ width: size, height: size }}
                  title={format(displayCreatedAt(c.created_at), "h:mm a")}
                  aria-label={
                    anonymizePhotos
                      ? `Capture at ${format(displayCreatedAt(c.created_at), "h:mm a")}`
                      : `Open capture from ${format(displayCreatedAt(c.created_at), "h:mm a")}`
                  }
                >
                  <PhotoPin
                    photoUrl={c.photo_url}
                    size={size}
                    isOwn={isOwn}
                    className={isCityPin ? "city" : undefined}
                  />
                  {!isCityPin && (
                    <span
                      className="map-pin-dot"
                      style={{ background: color }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </Marker>
            );
          })}

        {showCrossings &&
          crossings.map((x, idx) => (
            <Marker
              key={`${x.aDeviceId}-${x.bDeviceId}-${idx}`}
              latitude={x.lat}
              longitude={x.lng}
            >
              <button
                type="button"
                className={`crossing-dot${focus === "crossings" ? " crossing-dot-focus" : ""}`}
                title="Paths crossed here"
                aria-label="Path crossing"
                onClick={(e) => {
                  e.stopPropagation();
                  setPopup(null);
                  setCrossingPopup(x);
                }}
              />
            </Marker>
          ))}

        {crossingPopup && (
          <Popup
            latitude={crossingPopup.lat}
            longitude={crossingPopup.lng}
            anchor="bottom"
            offset={16}
            closeOnClick
            onClose={() => setCrossingPopup(null)}
            className="crossing-popup"
          >
            <p className="crossing-popup-text">
              📍 You and @
              {crossingFriendName(crossingPopup, paths, ownDeviceId)} were
              both here around{" "}
              {format(new Date(crossingPopup.timeA), "h:mm a")} today
            </p>
          </Popup>
        )}

        {popup && (
          <Popup
            latitude={displayCoords.get(popup.id)?.lat ?? popup.lat}
            longitude={displayCoords.get(popup.id)?.lng ?? popup.lng}
            anchor="bottom"
            offset={28}
            closeOnClick={false}
            onClose={() => {
              setPopup(null);
              setConfirmDelete(false);
              setDeleteError("");
            }}
            className="checkin-popup"
          >
            <div className="checkin-popup-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={popup.photo_url} alt="" />
              <strong>
                {format(displayCreatedAt(popup.created_at), "h:mm a")}
              </strong>
              {popup.location_name?.trim() ? (
                <p className="checkin-location">{popup.location_name.trim()}</p>
              ) : null}
              {popup.caption && <p>{popup.caption}</p>}
              {deleteError && <p className="status error">{deleteError}</p>}
              {canDeletePopup &&
                (confirmDelete ? (
                  <div className="checkin-card-confirm">
                    <span>Remove this spot?</span>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn danger"
                        disabled={deleting}
                        onClick={() => void confirmPopupDelete()}
                      >
                        {deleting ? "Removing…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={deleting}
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Remove
                  </button>
                ))}
            </div>
          </Popup>
        )}
      </MapboxMap>
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
          {p.checkins.length === 1 ? "capture" : "captures"}
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
