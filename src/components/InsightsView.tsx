"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getAllCheckins,
  getFriendDeviceIds,
  getProfileByDeviceId,
  getTodayCityCheckins,
} from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { captureMomentNearLabel } from "@/lib/landmarks";
import { displayCreatedAt } from "@/lib/prompts";
import {
  activeSince,
  dailyCounts,
  densestCells,
  hourlyDistribution,
  uniqueContributors,
} from "@/lib/stats";
import type { CheckIn, PathSeries } from "@/lib/types";
import { PathMap } from "./PathMap";

const REFRESH_MS = 25_000;
const LIVE_WINDOW_MS = 30 * 60 * 1000;

const CHART_TICK = { fill: "var(--color-text-muted)", fontSize: 11 };
const CHART_AXIS = { stroke: "var(--color-green-secondary)" };
const CHART_TOOLTIP = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-green-secondary)",
  borderRadius: "8px",
  color: "var(--color-text)",
};

function usernameFor(
  deviceId: string,
  usernames: Record<string, string>,
): string {
  return (
    usernames[deviceId] ||
    deviceId.replace(/-/g, "").slice(0, 6).toUpperCase()
  );
}

/** Friends + yourself see @username; strangers stay anonymous. */
function actorLabel(
  deviceId: string,
  usernames: Record<string, string>,
  friendIds: Set<string>,
  myDeviceId: string | null,
): string {
  const isMe = Boolean(myDeviceId && deviceId === myDeviceId);
  if (isMe || friendIds.has(deviceId)) {
    return `@${usernameFor(deviceId, usernames)}`;
  }
  return "A user";
}

/** Place name only — never the "Someone captured…" sentence. */
function placeForCheckIn(c: CheckIn): string | null {
  const stored = c.location_name?.trim();
  if (stored) return stored;
  const label = captureMomentNearLabel(c.lat, c.lng, c.location_name);
  if (/nearby$/i.test(label.trim())) return null;
  const match = label.match(/\bnear\s+(.+)$/i);
  const place = match?.[1]?.trim();
  if (!place || /^by$/i.test(place)) return null;
  return place;
}

function liveFeedLine(
  c: CheckIn,
  usernames: Record<string, string>,
  friendIds: Set<string>,
  myDeviceId: string | null,
): string {
  const time = format(displayCreatedAt(c.created_at), "h:mm a");
  const actor = actorLabel(c.device_id, usernames, friendIds, myDeviceId);
  const place = placeForCheckIn(c);
  if (place) return `${time} · ${actor} · near ${place}`;
  return `${time} · ${actor}`;
}

function FeedPolaroid({
  photoUrl,
  rotate = 2,
}: {
  photoUrl: string;
  rotate?: number;
}) {
  return (
    <span
      className="live-feed-polaroid"
      style={{ ["--feed-rot" as string]: `${rotate}deg` }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl} alt="" />
    </span>
  );
}

export function InsightsView() {
  const [today, setToday] = useState<CheckIn[]>([]);
  const [all, setAll] = useState<CheckIn[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const profileCache = useRef<Map<string, string>>(new Map());
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [friendIds, setFriendIds] = useState<Set<string>>(() => new Set());

  async function resolveUsername(deviceId: string): Promise<string> {
    if (profileCache.current.has(deviceId)) {
      return profileCache.current.get(deviceId)!;
    }
    const profile = await getProfileByDeviceId(deviceId);
    const name =
      profile?.display_name ||
      deviceId.replace(/-/g, "").slice(0, 6).toUpperCase();
    profileCache.current.set(deviceId, name);
    return name;
  }

  useEffect(() => {
    const me = getDeviceId();
    setMyDeviceId(me || null);
    if (!me) return;
    let cancelled = false;
    void getFriendDeviceIds(me)
      .then((ids) => {
        if (!cancelled) setFriendIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setFriendIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [t, a] = await Promise.all([
          getTodayCityCheckins(),
          getAllCheckins(),
        ]);
        if (cancelled) return;
        setToday(t);
        setAll(a);
        setUpdatedAt(new Date());
      } catch {
        /* keep last good snapshot */
      }
    }

    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    // Only resolve usernames for people we can show (@me / @friends).
    const visibleIds = new Set<string>();
    if (myDeviceId) visibleIds.add(myDeviceId);
    for (const id of friendIds) visibleIds.add(id);

    const missing = [
      ...new Set(
        all.map((c) => c.device_id).filter((id) => visibleIds.has(id)),
      ),
    ].filter((id) => !profileCache.current.has(id));

    missing.forEach(async (deviceId) => {
      const name = await resolveUsername(deviceId);
      setUsernames((prev) =>
        prev[deviceId] ? prev : { ...prev, [deviceId]: name },
      );
    });
  }, [all, friendIds, myDeviceId]);

  const live = useMemo(() => activeSince(all, LIVE_WINDOW_MS), [all]);
  const byHour = useMemo(() => hourlyDistribution(today), [today]);
  const growth = useMemo(() => dailyCounts(all, 14), [all]);
  const densest = useMemo(() => densestCells(today, 5), [today]);
  const recent = useMemo(
    () =>
      [...all]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 3),
    [all],
  );

  const cityPaths: PathSeries[] = useMemo(
    () => [
      {
        deviceId: "city-insights",
        color: "#4a7c59",
        label: "City",
        checkins: today,
        connect: false,
      },
    ],
    [today],
  );

  return (
    <main className="fill-page">
      <div className="dashboard insights">
        <div className="panel dash-hero insights-hero">
          <h1>Insights</h1>
          <p className="meta insights-scope">
            Community Finds
          </p>
          <p className="meta insights-updated">
            <span className="live-dot" aria-hidden="true" />
            {updatedAt
              ? `Updated ${format(updatedAt, "h:mm a")}`
              : "Loading…"}
          </p>
        </div>

        <section className="chart-panel live-band">
          <h2 className="live-title">
            <span className="live-dot" aria-hidden="true" />
            Live
          </h2>
          <p className="chart-hint">Last 30 minutes · citywide</p>
          <div className="live-metrics">
            <article>
              <strong>{live.length}</strong>
              <span>captures</span>
            </article>
            <article>
              <strong>{uniqueContributors(live)}</strong>
              <span>contributors</span>
            </article>
          </div>

          <ul className="live-feed">
            {recent.length === 0 && (
              <li className="meta">No captures yet — add one from Home.</li>
            )}
            {recent.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/map?layer=city&view=lines&lat=${c.lat}&lng=${c.lng}`}
                  className="live-feed-row"
                >
                  <span className="live-feed-body">
                    {liveFeedLine(c, usernames, friendIds, myDeviceId)}
                  </span>
                  {c.photo_url?.trim() ? (
                    <FeedPolaroid
                      photoUrl={c.photo_url}
                      rotate={i % 2 === 0 ? 2.5 : -2}
                    />
                  ) : null}
                </Link>
              </li>
            ))}
            {all.length > 3 && (
              <li>
                <button
                  className="see-all-btn"
                  onClick={() => setShowAll(true)}
                >
                  See all {all.length} captures →
                </button>
              </li>
            )}
          </ul>

          {showAll && (
            <div className="captures-sheet">
              <div className="captures-sheet-inner">
                <div className="captures-sheet-header">
                  <h2>All captures today</h2>
                  <button
                    className="captures-close"
                    onClick={() => setShowAll(false)}
                  >
                    ×
                  </button>
                </div>
                <ul className="captures-list">
                  {[...all]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((c, i) => (
                      <li key={c.id} className="captures-row">
                        <span className="captures-row-copy">
                          {liveFeedLine(c, usernames, friendIds, myDeviceId)}
                        </span>
                        {c.photo_url?.trim() ? (
                          <FeedPolaroid
                            photoUrl={c.photo_url}
                            rotate={i % 2 === 0 ? 2 : -2.5}
                          />
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="chart-panel">
          <h2>Today</h2>
          <p className="meta chart-hint">Citywide · today</p>
          <div className="insights-window-stats">
            <article>
              <strong>{today.length}</strong>
              <span>captures today</span>
            </article>
            <article>
              <strong>{uniqueContributors(today)}</strong>
              <span>contributors today</span>
            </article>
          </div>
          <p className="meta chart-hint">Peak hours</p>
          <div className="chart-wrap chart-wrap-compact">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byHour} style={{ background: "transparent" }}>
                <XAxis
                  dataKey="hour"
                  tick={CHART_TICK}
                  axisLine={CHART_AXIS}
                  tickLine={false}
                  interval={1}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ ...CHART_TICK, fontSize: 12 }}
                  axisLine={CHART_AXIS}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  formatter={(value) => [value ?? 0, "captures"]}
                  labelFormatter={(hour) => `${hour}:00`}
                  contentStyle={CHART_TOOLTIP}
                />
                <Bar
                  dataKey="count"
                  fill="var(--color-green-primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="insights-section-head insights-map-head">
            <h3 className="themes-subhead">Where people are contributing</h3>
            <Link className="btn ghost" href="/map?layer=city&view=heatmap">
              Map
            </Link>
          </div>
          <div className="insights-map-embed">
            <PathMap
              paths={cityPaths}
              anonymizePhotos
              viewMode="heatmap"
              focus="checkins"
            />
          </div>
          <ul className="dense-list">
            {densest.length === 0 && <li>No clusters yet today.</li>}
            {densest.map((d) => (
              <li key={d.key}>
                <Link
                  href={`/map?layer=city&filter=checkins&view=heatmap&lat=${d.lat}&lng=${d.lng}`}
                  className="dense-link"
                >
                  <span>Near {d.label}</span>
                  <strong>{d.count} captures</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="chart-panel">
          <h2>Last 14 days</h2>
          <p className="meta chart-hint">Citywide captures per day</p>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={growth} style={{ background: "transparent" }}>
                <XAxis
                  dataKey="label"
                  tick={CHART_TICK}
                  axisLine={CHART_AXIS}
                  tickLine={false}
                  interval={1}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ ...CHART_TICK, fontSize: 12 }}
                  axisLine={CHART_AXIS}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  formatter={(value) => [value ?? 0, "captures"]}
                  labelFormatter={(label) => String(label)}
                  contentStyle={CHART_TOOLTIP}
                />
                <Bar
                  dataKey="count"
                  fill="var(--color-green-primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-panel">
          <h2>All time</h2>
          <p className="meta chart-hint">Citywide · all time</p>
          <div className="insights-window-stats">
            <article>
              <strong>{all.length}</strong>
              <span>captures</span>
            </article>
            <article>
              <strong>{uniqueContributors(all)}</strong>
              <span>contributors</span>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
