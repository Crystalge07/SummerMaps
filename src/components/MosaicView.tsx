"use client";

import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import {
  parseDayKey,
  type MosaicDay,
} from "@/lib/mosaic";
import type { CheckIn } from "@/lib/types";

type Props = {
  day: MosaicDay;
  onClose: () => void;
};

const CROP_POSITIONS = [
  "50% 50%",
  "30% 40%",
  "70% 35%",
  "45% 65%",
  "60% 50%",
  "35% 55%",
  "55% 30%",
  "40% 70%",
] as const;

/** Stable slight tilts — enough charm, not overlapping chaos. */
const TILE_ROTATIONS = [-2.4, 1.8, -1.2, 2.6, -2.1, 1.4, -2.8, 1.6, -0.9, 2.2] as const;

function tileRotation(index: number): string {
  return `${TILE_ROTATIONS[index % TILE_ROTATIONS.length]}deg`;
}

export function MosaicView({ day, onClose }: Props) {
  const count = day.checkins.length;
  // Prefer 4 columns so more of the day fits on screen.
  const cols = count <= 1 ? 1 : Math.min(count, 4);
  const dateLabel = format(parseDayKey(day.dayKey), "MMMM d, yyyy");
  const status = day.locked ? "Locked" : "Live";

  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [entered, setEntered] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  const seenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const ids = day.checkins.map((c) => c.id);
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(ids);
      return;
    }
    const fresh = new Set<string>();
    for (const id of ids) {
      if (!seenIdsRef.current.has(id)) fresh.add(id);
    }
    seenIdsRef.current = new Set(ids);
    if (fresh.size === 0) return;

    setNewIds(fresh);
    const timer = window.setTimeout(() => setNewIds(new Set()), 2400);
    return () => window.clearTimeout(timer);
  }, [day.checkins]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selected) {
        setSelected(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, selected]);

  return (
    <div
      className={`mosaic-overlay${entered ? " mosaic-overlay-entered" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Mosaic for ${dateLabel}`}
    >
      <div className="mosaic-board-texture" aria-hidden="true" />

      <div
        className="mosaic-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {day.checkins.map((c, i) => {
          const isNew = newIds.has(c.id);
          const rot = tileRotation(i);
          return (
            <button
              key={c.id}
              type="button"
              className={`mosaic-tile-btn${isNew ? " mosaic-tile-new" : ""}`}
              style={{
                animationDelay: `${Math.min(i, 24) * 45}ms`,
                ["--mosaic-rot" as string]: rot,
              }}
              onClick={() => setSelected(c)}
              aria-label={c.caption || `Open find from ${dateLabel}`}
            >
              <span className="mosaic-polaroid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.photo_url}
                  alt=""
                  className="mosaic-tile"
                  style={{
                    objectPosition: CROP_POSITIONS[i % CROP_POSITIONS.length],
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>

      <header className="mosaic-chrome">
        <div className="mosaic-chrome-copy">
          <p className="mosaic-kicker">{dateLabel}</p>
          <h2>
            <em>{day.prompt}</em>
          </h2>
          <p className="mosaic-meta">
            {status} · {count} {count === 1 ? "find" : "finds"}
          </p>
        </div>
        <button type="button" className="btn mosaic-close" onClick={onClose}>
          Close
        </button>
      </header>

      {selected ? (
        <div
          className="mosaic-detail"
          role="dialog"
          aria-modal="true"
          aria-label="Find detail"
        >
          <button
            type="button"
            className="mosaic-detail-backdrop"
            aria-label="Close detail"
            onClick={() => setSelected(null)}
          />
          <div className="mosaic-detail-panel">
            <div className="mosaic-detail-polaroid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.photo_url}
                alt={selected.caption || `Find from ${dateLabel}`}
                className="mosaic-detail-photo"
              />
              {selected.caption ? (
                <p className="mosaic-detail-frame-caption">{selected.caption}</p>
              ) : null}
            </div>
            <div className="mosaic-detail-copy">
              {selected.location_name ? (
                <p className="mosaic-detail-place">
                  spotted at {selected.location_name}
                </p>
              ) : !selected.caption ? (
                <p className="mosaic-detail-place">
                  A little thing from {dateLabel}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="btn mosaic-detail-close"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
