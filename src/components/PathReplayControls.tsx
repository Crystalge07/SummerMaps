"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  enabled: boolean;
  onProgress: (progress: number) => void;
};

export function PathReplayControls({ enabled, onProgress }: Props) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(1);
  const raf = useRef<number | null>(null);
  const progressRef = useRef(1);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }

    const duration = 4200;
    const origin = performance.now() - progressRef.current * duration;

    const tick = (now: number) => {
      const next = Math.min(1, (now - origin) / duration);
      setProgress(next);
      onProgress(next);
      if (next < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, onProgress]);

  if (!enabled) return null;

  return (
    <div className="replay-bar">
      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          if (progress >= 1) {
            setProgress(0);
            onProgress(0);
            progressRef.current = 0;
          }
          setPlaying((p) => !p);
        }}
      >
        {playing ? "Pause" : progress >= 1 ? "Replay path" : "Play"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={progress}
        onChange={(e) => {
          const v = Number(e.target.value);
          setPlaying(false);
          setProgress(v);
          onProgress(v);
        }}
      />
      <span>{Math.round(progress * 100)}%</span>
    </div>
  );
}
