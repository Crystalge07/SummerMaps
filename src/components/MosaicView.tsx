"use client";

import { format } from "date-fns";
import { useEffect } from "react";
import {
  lastRowSpans,
  mosaicGridDims,
  parseDayKey,
  type MosaicDay,
} from "@/lib/mosaic";

type Props = {
  day: MosaicDay;
  onClose: () => void;
};

export function MosaicView({ day, onClose }: Props) {
  const count = day.checkins.length;
  const { cols, rows } = mosaicGridDims(count);
  const lastStart = Math.max(0, (rows - 1) * cols);
  const lastCount = count - lastStart;
  const spans = lastRowSpans(lastCount, cols);
  const dateLabel = format(parseDayKey(day.dayKey), "MMMM d, yyyy");
  const status = day.locked ? "Locked" : "Live";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="mosaic-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Mosaic for ${dateLabel}`}
    >
      <div
        className="mosaic-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {day.checkins.map((c, i) => {
          const inLastRow = i >= lastStart;
          const span = inLastRow ? spans[i - lastStart] : 1;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={c.id}
              src={c.photo_url}
              alt={c.caption || `Find from ${dateLabel}`}
              className="mosaic-tile"
              style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}
            />
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
    </div>
  );
}
