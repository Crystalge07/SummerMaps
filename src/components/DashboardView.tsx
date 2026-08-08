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
import { getTodaysPrompt } from "@/lib/prompts";
import { densestCells, hourlyDistribution } from "@/lib/stats";
import type { CheckIn } from "@/lib/types";

const STATS = [
  {
    key: "finds",
    label: "finds today",
    href: "/city?filter=checkins&view=lines",
    icon: "/brand/path-mark.svg",
  },
  {
    key: "noticers",
    label: "people noticing",
    href: "/city?filter=noticers&view=lines",
    icon: "/brand/path-mark.svg",
  },
  {
    key: "prompt",
    label: "today's prompt",
    href: "/check-in",
    icon: "/brand/pin.svg",
    display: "text" as const,
  },
  {
    key: "alltime",
    label: "all-time finds",
    href: "/city?filter=alltime&view=heatmap",
    icon: "/brand/path-mark.svg",
  },
] as const;

export function DashboardView() {
  const [today, setToday] = useState<CheckIn[]>([]);
  const [all, setAll] = useState<CheckIn[]>([]);
  const prompt = getTodaysPrompt();

  useEffect(() => {
    getTodayCityCheckins().then(setToday);
    getAllCheckins().then(setAll);
  }, []);

  const byHour = useMemo(() => hourlyDistribution(today), [today]);
  const uniqueNoticers = useMemo(
    () => new Set(today.map((c) => c.device_id)).size,
    [today],
  );
  const densest = useMemo(() => densestCells(today, 5), [today]);
  const busiest = densest[0] ?? null;

  const values: Record<string, string | number> = {
    finds: today.length,
    noticers: uniqueNoticers,
    prompt,
    alltime: all.length,
  };

  return (
    <div className="dashboard has-atmosphere">
      <div className="illus-strip" aria-hidden />

      <div className="panel dash-hero">
        <div className="panel-kicker">City intelligence</div>
        <h1>Pulse</h1>
        <p className="lede">
          Where today&apos;s prompt (<em>{prompt}</em>) showed up — busiest
          hours and densest spots. Tap a stat to explore it. Aggregates only; no
          identities.
        </p>
      </div>

      <div className="stat-row">
        {STATS.map((stat) => (
          <Link
            key={stat.key}
            href={stat.href}
            className="stat-card"
            aria-label={`Explore ${stat.label}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stat.icon} alt="" className="stat-icon" />
            <strong
              className={
                "display" in stat && stat.display === "text"
                  ? "stat-text"
                  : undefined
              }
            >
              {values[stat.key]}
            </strong>
            <span>{stat.label}</span>
          </Link>
        ))}
      </div>

      <section className="busiest-card chart-panel">
        <div className="busiest-copy">
          <h2>Busiest spot today</h2>
          {busiest ? (
            <>
              <p className="busiest-count">
                <strong>{busiest.count}</strong> finds near{" "}
                <span>
                  {busiest.lat.toFixed(2)}, {busiest.lng.toFixed(2)}
                </span>
              </p>
              <Link
                className="btn primary"
                href={`/city?filter=checkins&view=heatmap&lat=${busiest.lat}&lng=${busiest.lng}`}
              >
                Open on city map
              </Link>
            </>
          ) : (
            <p className="meta">No finds yet today.</p>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/pin.svg" alt="" className="busiest-pin" />
      </section>

      <section className="chart-panel">
        <h2>Hourly distribution today</h2>
        <p className="meta chart-hint">Finds by hour (0–23)</p>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
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
                formatter={(value) => [value ?? 0, "finds"]}
                labelFormatter={(hour) => `${hour}:00`}
              />
              <Bar dataKey="count" fill="#1F8A70" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-panel">
        <h2>Densest coordinate cells</h2>
        <ul className="dense-list">
          {densest.length === 0 && <li>No finds yet today.</li>}
          {densest.map((d) => (
            <li key={d.key}>
              <span>{d.key}</span>
              <strong>{d.count}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="chart-panel">
        <h2>Latest city finds</h2>
        <ul className="dense-list">
          {today
            .slice()
            .reverse()
            .slice(0, 8)
            .map((c) => (
              <li key={c.id}>
                <span>{format(new Date(c.created_at), "h:mm a")}</span>
                <strong>
                  {c.lat.toFixed(3)}, {c.lng.toFixed(3)}
                </strong>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
