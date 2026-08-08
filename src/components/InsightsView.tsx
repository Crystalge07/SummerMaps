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
import {
  activeSince,
  captionKeywords,
  captionMoodShares,
  dailyCounts,
  densestCells,
  hourlyDistribution,
  promptThemeCounts,
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
  const promptThemes = useMemo(() => promptThemeCounts(all, 8), [all]);
  const keywords = useMemo(() => captionKeywords(all, 10), [all]);
  const mood = useMemo(() => captionMoodShares(all), [all]);
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

  const moodInsight =
    mood.labeled < 3
      ? "Not enough captions yet to read the mood."
      : mood.warm >= mood.curious && mood.warm >= mood.neutral
        ? "Captions skew warm."
        : mood.curious >= mood.warm && mood.curious >= mood.neutral
          ? "Captions skew curious."
          : "Captions mostly read neutral.";

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
                    {c.caption?.trim()
                      ? c.caption.trim()
                      : c.prompt
                        ? `Spotted “${c.prompt}”`
                        : "New capture"}
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
              viewMode="lines"
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

        <section className="chart-panel">
          <h2>Themes &amp; mood</h2>
          <p className="meta chart-hint">
            Citywide prompts and captions
          </p>
          <div className="themes-grid">
            <div>
              <h3 className="themes-subhead">Prompt themes</h3>
              <ul className="theme-bars">
                {promptThemes.length === 0 && (
                  <li className="meta">No prompt data yet.</li>
                )}
                {promptThemes.map((t) => {
                  const max = promptThemes[0]?.count || 1;
                  return (
                    <li key={t.label}>
                      <span className="theme-label">{t.label}</span>
                      <span
                        className="theme-bar"
                        style={{
                          width: `${Math.max(8, (t.count / max) * 100)}%`,
                        }}
                      />
                      <strong>{t.count}</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3 className="themes-subhead">Caption keywords</h3>
              <ul className="theme-chips">
                {keywords.length === 0 && (
                  <li className="meta">No captions yet.</li>
                )}
                {keywords.map((k) => (
                  <li key={k.label}>
                    <span className="theme-chip">
                      {k.label} <em>{k.count}</em>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mood-block">
            <h3 className="themes-subhead">Community mood</h3>
            <p className="mood-insight">{moodInsight}</p>
            {mood.labeled > 0 && (
              <div className="mood-bars">
                <MoodRow label="Warm" count={mood.warm} total={mood.labeled} />
                <MoodRow
                  label="Curious"
                  count={mood.curious}
                  total={mood.labeled}
                />
                <MoodRow
                  label="Neutral"
                  count={mood.neutral}
                  total={mood.labeled}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MoodRow({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mood-row">
      <span>{label}</span>
      <div className="mood-track">
        <div className="mood-fill" style={{ width: `${pct}%` }} />
      </div>
      <strong>
        {count} · {pct}%
      </strong>
    </div>
  );
}
