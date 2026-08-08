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
import { getAllCheckins, getTodayCityCheckins } from "@/lib/api";
import {
  buildMosaicDays,
  isAfterMosaicCutoff,
  mosaicLockNotifKey,
  MOSAIC_CUTOFF_HOUR,
  parseDayKey,
  type MosaicDay,
} from "@/lib/mosaic";
import { dayKey, getTodaysPrompt } from "@/lib/prompts";
import { densestCells, hourlyDistribution } from "@/lib/stats";
import type { CheckIn } from "@/lib/types";
import { MosaicView } from "./MosaicView";

const STATS = [
  {
    key: "finds",
    label: "finds today",
    href: "/map?layer=city&filter=checkins&view=lines",
    icon: "/brand/path-mark.svg",
  },
  {
    key: "noticers",
    label: "people noticing",
    href: "/map?layer=city&filter=noticers&view=lines",
    icon: "/brand/path-mark.svg",
  },
  {
    key: "prompt",
    label: "today's prompt",
    href: "/",
    icon: "/brand/pin.svg",
    display: "text" as const,
  },
  {
    key: "alltime",
    label: "all-time finds",
    href: "/map?layer=city&filter=alltime&view=heatmap",
    icon: "/brand/path-mark.svg",
  },
] as const;

function cutoffLabel() {
  const hour = MOSAIC_CUTOFF_HOUR % 12 || 12;
  const suffix = MOSAIC_CUTOFF_HOUR >= 12 ? "pm" : "am";
  return `${hour}${suffix}`;
}

function MemoryCard({
  day,
  onOpen,
  badge,
}: {
  day: MosaicDay;
  onOpen: () => void;
  badge?: string;
}) {
  return (
    <button type="button" className="memory-card" onClick={onOpen}>
      <div className="memory-thumbs" aria-hidden="true">
        {day.checkins.slice(0, 4).map((c) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={c.id} src={c.photo_url} alt="" />
        ))}
      </div>
      <div className="memory-copy">
        <strong>
          {format(parseDayKey(day.dayKey), "MMM d, yyyy")}
          {badge ? <span className="memory-badge">{badge}</span> : null}
        </strong>
        <span>
          <em>{day.prompt}</em> · {day.checkins.length}{" "}
          {day.checkins.length === 1 ? "find" : "finds"}
        </span>
      </div>
    </button>
  );
}

export function DashboardView() {
  const [today, setToday] = useState<CheckIn[]>([]);
  const [all, setAll] = useState<CheckIn[]>([]);
  const [activeMosaic, setActiveMosaic] = useState<MosaicDay | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [showLockNotif, setShowLockNotif] = useState(false);
  const prompt = getTodaysPrompt();
  const todayKey = dayKey(now);
  const locked = isAfterMosaicCutoff(now);

  useEffect(() => {
    let cancelled = false;

    async function loadCity() {
      try {
        const [todayRows, allRows] = await Promise.all([
          getTodayCityCheckins(),
          getAllCheckins(),
        ]);
        if (cancelled) return;
        setToday(todayRows);
        setAll(allRows);
      } catch {
        /* ignore transient fetch errors */
      }
    }

    loadCity();
    // Shared city mosaic: poll often while live so everyone's finds appear.
    const ms = locked ? 120_000 : 20_000;
    const id = window.setInterval(loadCity, ms);
    const onFocus = () => loadCity();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [locked]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const mosaicDays = useMemo(() => buildMosaicDays(all, now), [all, now]);
  const todayMosaic = useMemo(
    () => mosaicDays.find((d) => d.dayKey === todayKey) ?? null,
    [mosaicDays, todayKey],
  );
  const memoryDays = useMemo(
    () => mosaicDays.filter((d) => d.locked),
    [mosaicDays],
  );

  useEffect(() => {
    if (!locked || !todayMosaic) {
      setShowLockNotif(false);
      return;
    }
    try {
      if (sessionStorage.getItem(mosaicLockNotifKey(todayKey))) {
        setShowLockNotif(false);
        return;
      }
    } catch {
      /* still show */
    }
    setShowLockNotif(true);
  }, [locked, todayMosaic, todayKey]);

  function dismissLockNotif() {
    try {
      sessionStorage.setItem(mosaicLockNotifKey(todayKey), "1");
    } catch {
      /* ignore */
    }
    setShowLockNotif(false);
  }

  function openTodaysMosaic() {
    if (!todayMosaic) return;
    dismissLockNotif();
    setActiveMosaic(todayMosaic);
  }

  // Keep open mosaic in sync while live (new finds refresh the collage).
  useEffect(() => {
    if (!activeMosaic) return;
    const next = mosaicDays.find((d) => d.dayKey === activeMosaic.dayKey);
    if (!next) return;
    const changed =
      next.locked !== activeMosaic.locked ||
      next.checkins.length !== activeMosaic.checkins.length ||
      next.checkins.some((c, i) => c.id !== activeMosaic.checkins[i]?.id);
    if (changed) setActiveMosaic(next);
  }, [mosaicDays, activeMosaic]);

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
    <main className="fill-page">
      <div className="dashboard">
        {showLockNotif && todayMosaic ? (
          <div className="mosaic-notif" role="status">
            <div className="mosaic-notif-copy">
              <strong>Check out today&apos;s mosaic</strong>
              <span>
                It&apos;s locked for the night — new finds still go on the map.
              </span>
            </div>
            <div className="mosaic-notif-actions">
              <button
                type="button"
                className="btn primary"
                onClick={openTodaysMosaic}
              >
                View mosaic
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={dismissLockNotif}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <div className="panel dash-hero memories-hero">
          <div className="panel-kicker">profile · memories</div>
          <h1>Memories</h1>
          <p className="lede">
            Everyone&apos;s finds build one shared mosaic live through the day.
            At {cutoffLabel()} it locks — later finds still hit the map, but not
            tonight&apos;s collage.
          </p>

          {!locked ? (
            todayMosaic ? (
              <div className="live-mosaic-block">
                <MemoryCard
                  day={todayMosaic}
                  badge="Live"
                  onOpen={() => setActiveMosaic(todayMosaic)}
                />
                <p className="meta">
                  City-wide · updating through {cutoffLabel()} · tap for full
                  screen
                </p>
              </div>
            ) : (
              <p className="meta memories-empty">
                As people notice today, their finds fill the shared mosaic until{" "}
                {cutoffLabel()}.
              </p>
            )
          ) : todayMosaic ? (
            <div className="memories-actions">
              <button
                type="button"
                className="btn primary"
                onClick={openTodaysMosaic}
              >
                Show today&apos;s mosaic
              </button>
              <span className="meta">
                Locked · {todayMosaic.checkins.length}{" "}
                {todayMosaic.checkins.length === 1 ? "find" : "finds"} ·{" "}
                <em>{todayMosaic.prompt}</em>
              </span>
            </div>
          ) : (
            <p className="meta memories-empty">
              No city finds before {cutoffLabel()} today — nothing locked into a
              mosaic.
            </p>
          )}
        </div>

        <section className="chart-panel memories-list-panel">
          <h2>Past mosaics</h2>
          {memoryDays.length === 0 ? (
            <p className="meta">
              After {cutoffLabel()}, today&apos;s shared collage lands here with
              the rest of the city&apos;s days.
            </p>
          ) : (
            <ul className="memories-list">
              {memoryDays.map((day) => (
                <li key={day.dayKey}>
                  <MemoryCard
                    day={day}
                    badge={day.dayKey === todayKey ? "Tonight" : undefined}
                    onOpen={() => setActiveMosaic(day)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="panel dash-hero">
          <div className="panel-kicker">profile · pulse</div>
          <h1>The pulse</h1>
          <p className="lede">
            Where today&apos;s prompt (<em>{prompt}</em>) showed up — busiest
            hours and densest spots. Tap a stat to explore it. Aggregates only;
            no identities.
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
                  href={`/map?layer=city&filter=checkins&view=heatmap&lat=${busiest.lat}&lng=${busiest.lng}`}
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
              <BarChart data={byHour} style={{ background: "transparent" }}>
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--color-green-secondary)" }}
                  tickLine={false}
                  interval={1}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--color-green-secondary)" }}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  formatter={(value) => [value ?? 0, "finds"]}
                  labelFormatter={(hour) => `${hour}:00`}
                  contentStyle={{
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-green-secondary)",
                    borderRadius: "8px",
                    color: "var(--color-text)",
                  }}
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

      {activeMosaic ? (
        <MosaicView
          day={activeMosaic}
          onClose={() => setActiveMosaic(null)}
        />
      ) : null}
    </main>
  );
}
