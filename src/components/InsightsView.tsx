"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAllCheckins, getTodayCityCheckins } from "@/lib/api";
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

export function InsightsView() {
  const [today, setToday] = useState<CheckIn[]>([]);
  const [all, setAll] = useState<CheckIn[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

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

  const cityPaths: PathSeries[] = useMemo(
    () => [
      {
        deviceId: "city-insights",
        color: "#1F8A70",
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
              <BarChart data={byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d5dde3" />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#405463", fontSize: 11 }}
                  interval={1}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#405463", fontSize: 12 }}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  formatter={(value) => [value ?? 0, "captures"]}
                  labelFormatter={(hour) => `${hour}:00`}
                />
                <Bar dataKey="count" fill="#C4A35A" radius={[4, 4, 0, 0]} />
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
              <BarChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d5dde3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#405463", fontSize: 11 }}
                  interval={1}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#405463", fontSize: 12 }}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  formatter={(value) => [value ?? 0, "captures"]}
                  labelFormatter={(label) => String(label)}
                />
                <Bar dataKey="count" fill="#1F8A70" radius={[4, 4, 0, 0]} />
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
    </main>
  );
}
