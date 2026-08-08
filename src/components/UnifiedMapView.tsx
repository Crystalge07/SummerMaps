"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  checkinsAsUnlinkedPins,
  deleteCheckIn,
  ensureDeviceProfile,
  getAllCheckins,
  getFriendDeviceIds,
  getProfileByDevice,
  getTodayCheckinsForDevices,
  getTodayCityCheckins,
} from "@/lib/api";
import { colorForDevice } from "@/lib/colors";
import { getDeviceId } from "@/lib/device";
import { friendCodeFromDeviceId } from "@/lib/friendCode";
import type { CheckIn, PathSeries } from "@/lib/types";
import { CheckInDetail } from "./CheckInDetail";
import { PathMap, type MapViewMode } from "./PathMap";
import { PathReplayControls } from "./PathReplayControls";

type PathToggle = "mine" | "friends";

function parseView(raw: string | null): MapViewMode {
  return raw === "heatmap" ? "heatmap" : "lines";
}

function initialPathToggles(layer: string | null): Record<PathToggle, boolean> {
  if (layer === "friends") return { mine: true, friends: true };
  if (layer === "mine") return { mine: true, friends: false };
  return { mine: false, friends: false };
}

function initialPanelOpen(layer: string | null) {
  return layer === "mine" || layer === "friends";
}

export function UnifiedMapView() {
  const params = useSearchParams();
  const filterParam = params.get("filter");
  const viewParam = params.get("view");
  const latParam = params.get("lat");
  const lngParam = params.get("lng");
  const layerParam = params.get("layer");
  const freshParam = params.get("fresh");

  const [myPath, setMyPath] = useState<PathSeries | null>(null);
  const [friendPaths, setFriendPaths] = useState<PathSeries[]>([]);
  const [cityPins, setCityPins] = useState<PathSeries[]>([]);
  const [pathToggles, setPathToggles] = useState<Record<PathToggle, boolean>>(
    () => initialPathToggles(layerParam),
  );
  const [panelOpen, setPanelOpen] = useState(() =>
    initialPanelOpen(layerParam),
  );
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<MapViewMode>(() =>
    parseView(viewParam),
  );
  const [replayProgress, setReplayProgress] = useState(1);

  useEffect(() => {
    setViewMode(parseView(viewParam));
  }, [viewParam]);

  useEffect(() => {
    setPathToggles(initialPathToggles(layerParam));
    setPanelOpen(initialPanelOpen(layerParam));
  }, [layerParam]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = getDeviceId();
      if (!me) {
        setMyPath(null);
        setFriendPaths([]);
        setCityPins([]);
        setError("Device id not ready yet — refresh and try again.");
        return;
      }

      await ensureDeviceProfile(me);
      const friendIds = await getFriendDeviceIds(me);
      const deviceIds = [me, ...friendIds];
      const checkins = await getTodayCheckinsForDevices(deviceIds);

      const byDevice = new Map<string, CheckIn[]>();
      for (const c of checkins) {
        const list = byDevice.get(c.device_id) ?? [];
        list.push(c);
        byDevice.set(c.device_id, list);
      }

      const series: PathSeries[] = await Promise.all(
        deviceIds.map(async (deviceId, index) => {
          const profile = await getProfileByDevice(deviceId);
          const code = profile?.code ?? friendCodeFromDeviceId(deviceId);
          const name = profile?.display_name?.trim();
          const label =
            deviceId === me
              ? name
                ? `You · ${name}`
                : "You"
              : name || code;
          const rows = (byDevice.get(deviceId) ?? []).sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          );
          return {
            deviceId,
            color: colorForDevice(deviceId, index),
            label,
            checkins: rows,
            connect: true,
          };
        }),
      );

      setMyPath(series.find((p) => p.deviceId === me) ?? null);
      setFriendPaths(series.filter((p) => p.deviceId !== me));

      const cityRows =
        filterParam === "alltime"
          ? await getAllCheckins()
          : await getTodayCityCheckins();
      setCityPins(checkinsAsUnlinkedPins(cityRows));
    } catch (err) {
      setMyPath(null);
      setFriendPaths([]);
      setCityPins([]);
      setError(err instanceof Error ? err.message : "Failed to load map.");
    } finally {
      setLoading(false);
    }
  }, [filterParam]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, freshParam, layerParam]);

  const pathsOn = pathToggles.mine || pathToggles.friends;

  const visiblePaths = useMemo(() => {
    // Path overlays reuse the same check-in ids as city pins — drop those
    // city pins so Marker keys stay unique and spots aren't doubled.
    const overlayIds = new Set<string>();
    if (pathToggles.mine && myPath) {
      for (const c of myPath.checkins) overlayIds.add(c.id);
    }
    if (pathToggles.friends) {
      for (const path of friendPaths) {
        for (const c of path.checkins) overlayIds.add(c.id);
      }
    }

    const cityLayer =
      overlayIds.size === 0
        ? cityPins
        : cityPins.filter(
            (pin) => !pin.checkins.some((c) => overlayIds.has(c.id)),
          );

    const next: PathSeries[] = [...cityLayer];
    if (pathToggles.mine && myPath) next.push(myPath);
    if (pathToggles.friends) next.push(...friendPaths);
    return next;
  }, [cityPins, friendPaths, myPath, pathToggles]);

  useEffect(() => {
    if (!selected) return;
    const stillVisible = visiblePaths.some((p) =>
      p.checkins.some((c) => c.id === selected.id),
    );
    if (!stillVisible) setSelected(null);
  }, [selected, visiblePaths]);

  const initialCenter = useMemo(() => {
    if (latParam && lngParam) {
      const lat = Number(latParam);
      const lng = Number(lngParam);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    }
    return undefined;
  }, [latParam, lngParam]);

  function togglePath(key: PathToggle) {
    setPathToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    setPanelOpen(true);
  }

  async function handleDeleteOwnCheckIn(checkIn: CheckIn) {
    const me = getDeviceId();
    if (!me || checkIn.device_id !== me) {
      throw new Error("You can only remove your own spots.");
    }
    await deleteCheckIn(checkIn.id, me);
    setMyPath((prev) =>
      prev
        ? {
            ...prev,
            checkins: prev.checkins.filter((c) => c.id !== checkIn.id),
          }
        : null,
    );
    setCityPins((prev) =>
      prev
        .map((pin) => ({
          ...pin,
          checkins: pin.checkins.filter((c) => c.id !== checkIn.id),
        }))
        .filter((pin) => pin.checkins.length > 0),
    );
    setSelected((prev) => (prev?.id === checkIn.id ? null : prev));
  }

  const myDeviceId = pathToggles.mine ? getDeviceId() || undefined : undefined;

  const legendPaths = [
    ...(pathToggles.mine && myPath ? [myPath] : []),
    ...(pathToggles.friends ? friendPaths : []),
  ];

  const showEmptyState =
    !loading &&
    pathToggles.mine &&
    !pathToggles.friends &&
    myPath !== null &&
    myPath.checkins.length === 0;

  const showReplay =
    pathsOn && pathToggles.mine && !!myPath && myPath.checkins.length > 0;

  return (
    <div className="unified-map">
      {!pathsOn && (
        <p className="map-city-header">
          <strong>City finds</strong>
          <span>what everyone spotted today</span>
        </p>
      )}

      <aside
        className={
          panelOpen ? "map-paths-panel open" : "map-paths-panel"
        }
      >
        <button
          type="button"
          className="map-paths-toggle"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
        >
          Paths
        </button>

        {panelOpen && (
          <div className="map-paths-body" role="group" aria-label="Path layers">
            <label className="map-paths-option">
              <input
                type="checkbox"
                checked={pathToggles.mine}
                onChange={() => togglePath("mine")}
              />
              <span>My path</span>
            </label>
            <label className="map-paths-option">
              <input
                type="checkbox"
                checked={pathToggles.friends}
                onChange={() => togglePath("friends")}
              />
              <span>Friends&apos; paths</span>
            </label>

            <div className="map-paths-divider" />

            <p className="map-paths-label">City view</p>
            <div className="map-paths-view" role="group" aria-label="City view">
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
                disabled={pathsOn}
                title={
                  pathsOn
                    ? "Heatmap is available when path overlays are off"
                    : undefined
                }
                onClick={() => setViewMode("heatmap")}
              >
                Heat
              </button>
            </div>
          </div>
        )}
      </aside>

      {loading && (
        <p
          className="map-status-chip"
          style={!pathsOn ? { top: "4.25rem" } : undefined}
        >
          Loading…
        </p>
      )}
      {error && !loading && (
        <p
          className="map-status-chip error"
          style={!pathsOn ? { top: "4.25rem" } : undefined}
        >
          {error}
        </p>
      )}

      <PathMap
        paths={visiblePaths}
        anonymizePhotos={false}
        onSelectCheckIn={setSelected}
        viewMode={pathsOn ? "lines" : viewMode}
        focus={pathsOn ? "all" : "checkins"}
        initialCenter={initialCenter}
        ownDeviceId={myDeviceId}
        replayProgress={showReplay ? replayProgress : 1}
        onDeleteCheckIn={
          myDeviceId ? (c) => handleDeleteOwnCheckIn(c) : undefined
        }
      />

      {legendPaths.length > 0 && (
        <ul className="map-legend-pills">
          {legendPaths.map((p) => (
            <li key={p.deviceId} className="map-legend-pill">
              <span className="swatch" style={{ background: p.color }} />
              {p.label.split(" · ")[0].split(" ")[0]}
            </li>
          ))}
        </ul>
      )}

      {showReplay && (
        <div className="map-replay-dock">
          <PathReplayControls enabled onProgress={setReplayProgress} />
        </div>
      )}

      {showEmptyState && (
        <div className="map-empty-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/path-mark.svg" alt="" />
          <strong>Your path starts with one spot</strong>
          <p>Spot today&apos;s prompt to drop your first pin.</p>
        </div>
      )}

      {selected && (
        <div className="map-detail-float">
          <button
            type="button"
            className="map-detail-close"
            aria-label="Close"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
          <CheckInDetail
            checkIn={selected}
            anonymize={
              !visiblePaths.some(
                (p) =>
                  p.connect !== false &&
                  p.checkins.some((c) => c.id === selected.id),
              )
            }
          />
        </div>
      )}
    </div>
  );
}
