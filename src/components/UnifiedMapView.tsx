"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
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
import { detectCrossings } from "@/lib/crossings";
import { getDeviceId } from "@/lib/device";
import { curvedLineThrough } from "@/lib/pathGeometry";
import type { CheckIn, PathSeries } from "@/lib/types";
import { CheckInDetail } from "./CheckInDetail";
import { PathMap, type MapViewMode, type PathReplayVisual } from "./PathMap";
import { PathReplayControls } from "./PathReplayControls";

type PathToggle = "mine" | "friends";

const LINE_MS = 400;
const PIN_MS = 250;

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

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function stateAtIndex(checkIns: CheckIn[], count: number) {
  const pinIds = new Set<string>();
  const lineDevices = new Set<string>();
  const lastByDevice = new Map<string, CheckIn>();
  const n = Math.max(0, Math.min(count, checkIns.length));
  for (let i = 0; i < n; i++) {
    const c = checkIns[i];
    if (lastByDevice.has(c.device_id)) lineDevices.add(c.device_id);
    lastByDevice.set(c.device_id, c);
    pinIds.add(c.id);
  }
  return { pinIds, lineDevices };
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

  const [isReplaying, setIsReplaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(100);
  const [replayActive, setReplayActive] = useState(false);
  const [replayHint, setReplayHint] = useState("");
  const [visiblePinIds, setVisiblePinIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [revealedLineDevices, setRevealedLineDevices] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandingPinId, setExpandingPinId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<PathReplayVisual["drawing"]>(null);

  const panelRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef(0);
  const resumeFromRef = useRef(0);

  useEffect(() => {
    setViewMode(parseView(viewParam));
  }, [viewParam]);

  useEffect(() => {
    setPathToggles(initialPathToggles(layerParam));
    setPanelOpen(initialPanelOpen(layerParam));
  }, [layerParam]);

  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node)) setPanelOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [panelOpen]);

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
          const name = profile?.display_name?.trim();
          const label =
            deviceId === me
              ? name
                ? `You · @${name}`
                : "You"
              : name
                ? `@${name}`
                : "Friend";
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

  const friendCrossings = useMemo(() => {
    if (!myPath || myPath.checkins.length === 0) return [];
    return friendPaths.flatMap((friendPath) =>
      friendPath.checkins.length === 0
        ? []
        : detectCrossings([myPath, friendPath]),
    );
  }, [myPath, friendPaths]);

  const strangerCrossingCount = useMemo(() => {
    if (!myPath || myPath.checkins.length === 0) return 0;
    const knownIds = new Set<string>();
    for (const c of myPath.checkins) knownIds.add(c.id);
    for (const path of friendPaths) {
      for (const c of path.checkins) knownIds.add(c.id);
    }
    const knownKeys = new Set<string>();
    for (const c of myPath.checkins) {
      knownKeys.add(`${c.lat}|${c.lng}|${c.created_at}`);
    }
    for (const path of friendPaths) {
      for (const c of path.checkins) {
        knownKeys.add(`${c.lat}|${c.lng}|${c.created_at}`);
      }
    }
    const strangers = cityPins.filter((pin) => {
      const c = pin.checkins[0];
      if (!c) return false;
      if (knownIds.has(c.id)) return false;
      return !knownKeys.has(`${c.lat}|${c.lng}|${c.created_at}`);
    });
    return strangers.reduce(
      (total, pin) => total + detectCrossings([myPath, pin]).length,
      0,
    );
  }, [myPath, friendPaths, cityPins]);

  const colorByDevice = useMemo(() => {
    const map = new Map<string, string>();
    if (myPath) map.set(myPath.deviceId, myPath.color);
    for (const p of friendPaths) map.set(p.deviceId, p.color);
    return map;
  }, [myPath, friendPaths]);

  const replayCheckIns = useMemo(() => {
    const list: CheckIn[] = [];
    if (pathToggles.mine && myPath) list.push(...myPath.checkins);
    if (pathToggles.friends) {
      for (const path of friendPaths) list.push(...path.checkins);
    }
    return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [pathToggles, myPath, friendPaths]);

  const visiblePaths = useMemo(() => {
    // During/after chronological replay: keep revealed pins even if their
    // path toggle is off — toggles only gate lines (see lineDeviceIds).
    if (replayActive) {
      const cityLayer = cityPins.filter(
        (pin) => !pin.checkins.some((c) => visiblePinIds.has(c.id)),
      );
      const next: PathSeries[] = [...cityLayer];
      if (myPath?.checkins.some((c) => visiblePinIds.has(c.id))) {
        next.push(myPath);
      }
      for (const path of friendPaths) {
        if (path.checkins.some((c) => visiblePinIds.has(c.id))) {
          next.push(path);
        }
      }
      return next;
    }

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
  }, [
    cityPins,
    friendPaths,
    myPath,
    pathToggles,
    replayActive,
    visiblePinIds,
  ]);

  // Lines follow toggles; pins revealed in replay stay even if their path is toggled off.
  const lineDeviceIds = useMemo(() => {
    const allowed = new Set<string>();
    if (pathToggles.mine && myPath) allowed.add(myPath.deviceId);
    if (pathToggles.friends) {
      for (const p of friendPaths) allowed.add(p.deviceId);
    }
    const next = new Set<string>();
    for (const id of revealedLineDevices) {
      if (allowed.has(id)) next.add(id);
    }
    return next;
  }, [revealedLineDevices, pathToggles, myPath, friendPaths]);

  const replayVisual: PathReplayVisual | null = useMemo(() => {
    if (!replayActive) return null;
    return {
      active: true,
      visiblePinIds,
      lineDeviceIds,
      drawing,
      expandingPinId,
    };
  }, [replayActive, visiblePinIds, lineDeviceIds, drawing, expandingPinId]);

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

  const animateLine = useCallback(
    (
      from: CheckIn,
      to: CheckIn,
      color: string,
      token: number,
    ): Promise<void> => {
      const coords = curvedLineThrough([
        [from.lng, from.lat],
        [to.lng, to.lat],
      ]);
      const start = performance.now();
      return new Promise((resolve) => {
        const tick = (now: number) => {
          if (abortRef.current !== token) {
            setDrawing(null);
            resolve();
            return;
          }
          const t = Math.min(1, (now - start) / LINE_MS);
          const count = Math.max(2, Math.ceil(coords.length * t));
          setDrawing({
            deviceId: to.device_id,
            coordinates: coords.slice(0, count),
            color,
          });
          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            setDrawing(null);
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    },
    [],
  );

  const runReplayFrom = useCallback(
    async (startIndex: number, checkIns: CheckIn[]) => {
      if (checkIns.length === 0) return;
      const token = ++abortRef.current;
      setIsReplaying(true);
      setReplayActive(true);
      setDrawing(null);
      setExpandingPinId(null);

      const base = stateAtIndex(checkIns, startIndex);
      const pinIds = new Set(base.pinIds);
      const lineDevices = new Set(base.lineDevices);
      const lastByDevice = new Map<string, CheckIn>();
      for (let i = 0; i < startIndex; i++) {
        lastByDevice.set(checkIns[i].device_id, checkIns[i]);
      }
      setVisiblePinIds(new Set(pinIds));
      setRevealedLineDevices(new Set(lineDevices));
      setReplayProgress(
        checkIns.length ? (startIndex / checkIns.length) * 100 : 0,
      );

      for (let i = startIndex; i < checkIns.length; i++) {
        if (abortRef.current !== token) return;
        const c = checkIns[i];
        const prev = lastByDevice.get(c.device_id);
        const color =
          colorByDevice.get(c.device_id) ?? colorForDevice(c.device_id);

        if (prev) {
          await animateLine(prev, c, color, token);
          if (abortRef.current !== token) return;
          lineDevices.add(c.device_id);
          setRevealedLineDevices(new Set(lineDevices));
        }
        lastByDevice.set(c.device_id, c);

        pinIds.add(c.id);
        setExpandingPinId(c.id);
        setVisiblePinIds(new Set(pinIds));
        await sleep(PIN_MS);
        if (abortRef.current !== token) return;
        setExpandingPinId(null);

        setReplayProgress(((i + 1) / checkIns.length) * 100);
        resumeFromRef.current = i + 1;
      }

      if (abortRef.current === token) {
        setIsReplaying(false);
        setReplayProgress(100);
        resumeFromRef.current = checkIns.length;
      }
    },
    [animateLine, colorByDevice],
  );

  function onReplay() {
    const checkIns = replayCheckIns;
    if (checkIns.length === 0) {
      setReplayHint("Enable a path to replay");
      window.setTimeout(() => setReplayHint(""), 2500);
      return;
    }
    setReplayHint("");
    abortRef.current += 1;
    setVisiblePinIds(new Set());
    setRevealedLineDevices(new Set());
    setDrawing(null);
    setExpandingPinId(null);
    setReplayProgress(0);
    setReplayActive(true);
    resumeFromRef.current = 0;
    void runReplayFrom(0, checkIns);
  }

  function onScrub(progress: number) {
    const checkIns = replayCheckIns;
    if (checkIns.length === 0) return;
    const clamped = Math.max(0, Math.min(100, progress));
    const count = Math.round((clamped / 100) * checkIns.length);
    abortRef.current += 1;
    setIsReplaying(false);
    setDrawing(null);
    setExpandingPinId(null);
    setReplayActive(true);
    const snap = stateAtIndex(checkIns, count);
    setVisiblePinIds(snap.pinIds);
    setRevealedLineDevices(snap.lineDevices);
    setReplayProgress(clamped);
    resumeFromRef.current = count;
  }

  function onScrubEnd(progress: number) {
    const checkIns = replayCheckIns;
    if (checkIns.length === 0) return;
    const clamped = Math.max(0, Math.min(100, progress));
    const count = Math.round((clamped / 100) * checkIns.length);
    resumeFromRef.current = count;
    if (count < checkIns.length) {
      void runReplayFrom(count, checkIns);
    }
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

  const showReplay = pathsOn && replayCheckIns.length > 0;

  return (
    <div className="unified-map">
      <div className="map-top-chrome">
        {!pathsOn && (
          <p className="map-city-header">
            <strong>City finds</strong>
            <span>what everyone spotted today</span>
          </p>
        )}
      </div>

      {loading && <p className="map-status-chip">Loading…</p>}
      {error && !loading && (
        <p className="map-status-chip error">{error}</p>
      )}

      {!loading && strangerCrossingCount >= 5 && (
        <div className="map-stranger-crossing-banner" role="status">
          <p>
            You crossed paths with strangers {strangerCrossingCount} times
            today without knowing it 🌐
          </p>
          <Link href="/friends">Add friends to see who →</Link>
        </div>
      )}

      <PathMap
        paths={visiblePaths}
        crossings={friendCrossings}
        anonymizePhotos={false}
        onSelectCheckIn={setSelected}
        viewMode={pathsOn ? "lines" : viewMode}
        focus={pathsOn ? "all" : "checkins"}
        initialCenter={initialCenter}
        ownDeviceId={myPath?.deviceId ?? myDeviceId}
        replayVisual={showReplay ? replayVisual : null}
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

      <div className="map-bottom-chrome">
        <aside
          ref={panelRef}
          className={panelOpen ? "map-paths-panel open" : "map-paths-panel"}
        >
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

          <button
            type="button"
            className="map-paths-toggle"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          >
            Paths
          </button>
        </aside>

        {showReplay && (
          <div className="map-replay-dock">
            <PathReplayControls
              enabled
              progress={replayProgress}
              isReplaying={isReplaying}
              onReplay={onReplay}
              onScrub={onScrub}
              onScrubEnd={onScrubEnd}
            />
            {replayHint ? (
              <p className="meta" role="status">
                {replayHint}
              </p>
            ) : null}
          </div>
        )}
      </div>

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
