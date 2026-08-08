"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  checkinsAsUnlinkedPins,
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

type ToggleKey = "mine" | "friends" | "city";

function parseView(raw: string | null): MapViewMode {
  return raw === "heatmap" ? "heatmap" : "lines";
}

/** Map legacy ?layer= links onto which overlays start enabled. */
function initialToggles(layer: string | null): Record<ToggleKey, boolean> {
  if (layer === "friends") return { mine: true, friends: true, city: false };
  if (layer === "city") return { mine: false, friends: false, city: true };
  return { mine: true, friends: false, city: false };
}

export function UnifiedMapView() {
  const params = useSearchParams();
  const filterParam = params.get("filter");
  const viewParam = params.get("view");
  const latParam = params.get("lat");
  const lngParam = params.get("lng");

  const [myPath, setMyPath] = useState<PathSeries | null>(null);
  const [friendPaths, setFriendPaths] = useState<PathSeries[]>([]);
  const [cityPins, setCityPins] = useState<PathSeries[]>([]);
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(() =>
    initialToggles(params.get("layer")),
  );
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<MapViewMode>(() =>
    parseView(viewParam),
  );

  useEffect(() => {
    setViewMode(parseView(viewParam));
  }, [viewParam]);

  const layerParam = params.get("layer");
  useEffect(() => {
    setToggles(initialToggles(layerParam));
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
  }, [loadAll]);

  const visiblePaths = useMemo(() => {
    const next: PathSeries[] = [];
    if (toggles.mine && myPath) next.push(myPath);
    if (toggles.friends) next.push(...friendPaths);
    if (toggles.city) next.push(...cityPins);
    return next;
  }, [cityPins, friendPaths, myPath, toggles]);

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

  function toggle(key: ToggleKey) {
    setToggles((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Keep at least one layer on so the map never goes blank by accident.
      if (!next.mine && !next.friends && !next.city) {
        return prev;
      }
      return next;
    });
  }

  return (
    <div className="unified-map">
      <div className="map-layer-bar" role="group" aria-label="Map layers">
        <button
          type="button"
          aria-pressed={toggles.mine}
          className={toggles.mine ? "toggle active" : "toggle"}
          onClick={() => toggle("mine")}
        >
          Mine
        </button>
        <button
          type="button"
          aria-pressed={toggles.friends}
          className={toggles.friends ? "toggle active" : "toggle"}
          onClick={() => toggle("friends")}
        >
          Friends
        </button>
        <button
          type="button"
          aria-pressed={toggles.city}
          className={toggles.city ? "toggle active" : "toggle"}
          onClick={() => toggle("city")}
        >
          City
        </button>
      </div>

      {toggles.city && (
        <div className="map-view-bar" role="group" aria-label="City view">
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
      )}

      {loading && <p className="map-status-chip">Loading…</p>}
      {error && !loading && <p className="map-status-chip error">{error}</p>}

      <PathMap
        paths={visiblePaths}
        anonymizePhotos={toggles.city && !toggles.mine && !toggles.friends}
        onSelectCheckIn={setSelected}
        viewMode={toggles.city && !toggles.mine && !toggles.friends ? viewMode : "lines"}
        focus={toggles.city && !toggles.mine && !toggles.friends ? "checkins" : "all"}
        initialCenter={initialCenter}
      />

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
              toggles.city &&
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
