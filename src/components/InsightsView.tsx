"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  getProfileByDeviceId,
  getTodayCityCheckins,
} from "@/lib/api";
import { friendCodeFromDeviceId } from "@/lib/friendCode";
import { captureMomentNearLabel } from "@/lib/landmarks";
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

export function InsightsView() {
  const [today, setToday] = useState<CheckIn[]>([]);
  const [all, setAll] = useState<CheckIn[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("");

  async function openSpot(checkIn: CheckIn) {
    setSelected(checkIn);
    setSelectedLabel("");
    try {
      const profile = await getProfileByDeviceId(checkIn.device_id);
      const name = profile?.display_name?.trim();
      setSelectedLabel(
        name || profile?.code || friendCodeFromDeviceId(checkIn.device_id),
      );
    } catch {
      setSelectedLabel(friendCodeFromDeviceId(checkIn.device_id));
    }
  }

  function closeSpot() {
    setSelected(null);
    setSelectedLabel("");
  }

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

  const live = useMemo(() => activeSince(all, LIVE_WINDOW_MS), [all]);
  const byHour = useMemo(() => hourlyDistribution(today), [today]);
  const growth = useMemo(() => dailyCounts(all, 14), [all]);
  const densest = useMemo(() => densestCells(today, 5), [today]);
  const recent = useMemo(
    () =>
      [...all]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 10),
    [all],
  );
  // Prefer `all` (select *) so location_name is present without changing queries.
  const todaySpots = useMemo(() => {
    const ids = new Set(today.map((c) => c.id));
    return [...all]
      .filter((c) => ids.has(c.id) && Boolean(c.photo_url?.trim()))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [all, today]);

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
            Citywide activity · not just your own
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
          <p className="meta chart-hint">Last 30 minutes · citywide</p>
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
            {recent.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/map?layer=city&view=lines&lat=${c.lat}&lng=${c.lng}`}
                  className="live-feed-row"
                >
                  <span className="live-feed-time">
                    {format(new Date(c.created_at), "h:mm a")}
                  </span>
                  <span className="live-feed-body">
                    {captureMomentNearLabel(c.lat, c.lng, c.location_name)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <h3 className="spots-heading">Today&apos;s spots</h3>
          {todaySpots.length === 0 ? (
            <p className="spots-empty">No spots yet today — be the first</p>
          ) : (
            <div className="spots-grid">
              {todaySpots.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="spots-grid-cell"
                  onClick={() => void openSpot(c)}
                  aria-label={`Open spot from ${format(new Date(c.created_at), "h:mm a")}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.photo_url} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="chart-panel">
          <h2>Today</h2>
          <p className="meta chart-hint">Citywide · today</p>
          <div className="stat-row insights-window-stats">
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
              Explore on map
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
            {densest.map((d, i) => (
              <li key={d.key}>
                <Link
                  href={`/map?layer=city&filter=checkins&view=heatmap&lat=${d.lat}&lng=${d.lng}`}
                  className="dense-link"
                >
                  <span>
                    Area {i + 1} · {d.lat.toFixed(2)}, {d.lng.toFixed(2)}
                  </span>
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
          <div className="stat-row insights-window-stats">
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

      {selected && (
        <div
          className="spots-sheet-backdrop"
          role="presentation"
          onClick={closeSpot}
        >
          <div
            className="spots-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Spot details"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="spots-sheet-close"
              aria-label="Close"
              onClick={closeSpot}
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.photo_url}
              alt=""
              className="spots-sheet-photo"
            />
            <div className="spots-sheet-body">
              <p className="spots-sheet-meta">
                <strong>
                  {selectedLabel ||
                    friendCodeFromDeviceId(selected.device_id)}
                </strong>
                <span>
                  {format(new Date(selected.created_at), "h:mm a")}
                </span>
              </p>
              {selected.caption?.trim() ? (
                <p className="spots-sheet-caption">{selected.caption.trim()}</p>
              ) : null}
              <p className="spots-sheet-location">
                {captureMomentNearLabel(
                  selected.lat,
                  selected.lng,
                  selected.location_name,
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
