"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { getAllCheckins } from "@/lib/api";
import {
  buildMosaicDays,
  isAfterMosaicCutoff,
  MOSAIC_CUTOFF_HOUR,
  parseDayKey,
  type MosaicDay,
} from "@/lib/mosaic";
import { dayKey } from "@/lib/prompts";
import { MosaicView } from "./MosaicView";

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
  const thumbs = day.checkins.slice(0, 9);
  const thumbClass =
    thumbs.length > 4 ? "memory-thumbs memory-thumbs-dense" : "memory-thumbs";

  return (
    <button type="button" className="memory-card" onClick={onOpen}>
      <div className={thumbClass} aria-hidden="true">
        {thumbs.map((c) => (
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
          {day.checkins.length === 1 ? "photo" : "photos"}
        </span>
      </div>
    </button>
  );
}

/** Shared city mosaics — lives on Profile. */
export function MemoriesPanel() {
  const [all, setAll] = useState<Awaited<ReturnType<typeof getAllCheckins>>>(
    [],
  );
  const [activeMosaic, setActiveMosaic] = useState<MosaicDay | null>(null);
  const [now, setNow] = useState(() => new Date());
  const todayKey = dayKey(now);
  const locked = isAfterMosaicCutoff(now);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const rows = await getAllCheckins();
        if (!cancelled) setAll(rows);
      } catch {
        /* ignore */
      }
    }

    void load();
    const ms = locked ? 120_000 : 20_000;
    const id = window.setInterval(() => void load(), ms);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [locked]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
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
    if (!activeMosaic) return;
    const next = mosaicDays.find((d) => d.dayKey === activeMosaic.dayKey);
    if (!next) return;
    const changed =
      next.locked !== activeMosaic.locked ||
      next.checkins.length !== activeMosaic.checkins.length ||
      next.checkins.some((c, i) => c.id !== activeMosaic.checkins[i]?.id);
    if (changed) setActiveMosaic(next);
  }, [mosaicDays, activeMosaic]);

  return (
    <>
      <section className="profile-block memories-block">
        <h2>Mosaic</h2>
        <p className="meta">
          Everyone&apos;s photos from the day — the full collage, all of them.
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
                {todayMosaic.checkins.length}{" "}
                {todayMosaic.checkins.length === 1 ? "photo" : "photos"} · tap
                to open
              </p>
            </div>
          ) : (
            <p className="meta memories-empty">
              As people capture today, every photo lands in the mosaic.
            </p>
          )
        ) : todayMosaic ? (
          <div className="memories-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => setActiveMosaic(todayMosaic)}
            >
              Show today&apos;s mosaic
            </button>
            <span className="meta">
              {todayMosaic.checkins.length}{" "}
              {todayMosaic.checkins.length === 1 ? "photo" : "photos"} ·{" "}
              <em>{todayMosaic.prompt}</em>
            </span>
          </div>
        ) : (
          <p className="meta memories-empty">No city photos today yet.</p>
        )}
      </section>

      <section className="profile-block">
        <h2>Past mosaics</h2>
        {memoryDays.length === 0 ? (
          <p className="meta">
            Past days show up here after {cutoffLabel()} ET, each with every photo
            from that day.
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

      {activeMosaic ? (
        <MosaicView
          day={activeMosaic}
          onClose={() => setActiveMosaic(null)}
        />
      ) : null}
    </>
  );
}
