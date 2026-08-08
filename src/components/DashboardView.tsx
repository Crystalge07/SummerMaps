"use client";

import { format } from "date-fns";
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
import type { CheckIn } from "@/lib/types";

export function DashboardView() {
  const [today, setToday] = useState<CheckIn[]>([]);
  const [all, setAll] = useState<CheckIn[]>([]);
  const prompt = getTodaysPrompt();

  useEffect(() => {
    getTodayCityCheckins().then(setToday);
    getAllCheckins().then(setAll);
  }, []);

  const byHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}:00`,
      count: 0,
    }));
    for (const c of today) {
      buckets[new Date(c.created_at).getHours()].count += 1;
    }
    return buckets.filter((b) => b.count > 0 || today.length === 0);
  }, [today]);

  const uniqueNoticers = useMemo(
    () => new Set(today.map((c) => c.device_id)).size,
    [today],
  );

  const densest = useMemo(() => {
    const cells = new Map<string, number>();
    for (const c of today) {
      const key = `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;
      cells.set(key, (cells.get(key) ?? 0) + 1);
    }
    return Array.from(cells.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cell, count]) => ({ cell, count }));
  }, [today]);

  return (
    <div className="dashboard">
      <div className="panel dash-hero">
        <div className="panel-kicker">City intelligence</div>
        <h1>Pulse</h1>
        <p className="lede">
          Where today&apos;s prompt (<em>{prompt}</em>) showed up — busiest
          hours and densest spots. Aggregates only; no identities.
        </p>
      </div>

      <div className="stat-row">
        <article>
          <strong>{today.length}</strong>
          <span>finds today</span>
        </article>
        <article>
          <strong>{uniqueNoticers}</strong>
          <span>people noticing</span>
        </article>
        <article>
          <strong>{prompt}</strong>
          <span>today&apos;s prompt</span>
        </article>
        <article>
          <strong>{all.length}</strong>
          <span>all-time finds</span>
        </article>
      </div>

      <section className="chart-panel">
        <h2>Busiest hours today</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byHour.length ? byHour : [{ hour: "—", count: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d5dde3" />
              <XAxis dataKey="hour" tick={{ fill: "#405463", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#405463", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#1F8A70" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-panel">
        <h2>Densest coordinate cells</h2>
        <ul className="dense-list">
          {densest.length === 0 && <li>No check-ins yet today.</li>}
          {densest.map((d) => (
            <li key={d.cell}>
              <span>{d.cell}</span>
              <strong>{d.count}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="chart-panel">
        <h2>Latest city stops</h2>
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
