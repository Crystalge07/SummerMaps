"use client";

import { useEffect, useRef, useState } from "react";

type ControlledProps = {
  enabled: boolean;
  /** 0–100 */
  progress: number;
  isReplaying: boolean;
  onReplay: () => void;
  /** Live scrub — jump state without waiting for release. */
  onScrub: (progress: number) => void;
  /** After scrub release — resume animation from scrub point. */
  onScrubEnd?: (progress: number) => void;
  onProgress?: never;
};

type LegacyProps = {
  enabled: boolean;
  onProgress: (progress: number) => void;
  progress?: never;
  isReplaying?: never;
  onReplay?: never;
  onScrub?: never;
};

type Props = ControlledProps | LegacyProps;

function isControlled(props: Props): props is ControlledProps {
  return typeof (props as ControlledProps).onReplay === "function";
}

/** Chronological replay controls (controlled) or legacy progress scrubber. */
export function PathReplayControls(props: Props) {
  if (isControlled(props)) {
    return <ControlledReplay {...props} />;
  }
  return <LegacyReplay enabled={props.enabled} onProgress={props.onProgress} />;
}

function ControlledReplay({
  enabled,
  progress,
  isReplaying,
  onReplay,
  onScrub,
  onScrubEnd,
}: ControlledProps) {
  if (!enabled) return null;

  return (
    <div className="replay-bar">
      <button
        type="button"
        className="btn primary"
        disabled={isReplaying}
        onClick={() => onReplay()}
      >
        {isReplaying ? "Playing…" : "Replay"}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(progress)}
        aria-label="Replay progress"
        onChange={(e) => onScrub(Number(e.target.value))}
        onPointerUp={(e) =>
          onScrubEnd?.(Number((e.target as HTMLInputElement).value))
        }
        onKeyUp={(e) =>
          onScrubEnd?.(Number((e.target as HTMLInputElement).value))
        }
      />
      <span>{Math.round(progress)}%</span>
    </div>
  );
}

/** Older slice-based play loop for PersonalPathView / FriendsMapView. */
function LegacyReplay({
  enabled,
  onProgress,
}: {
  enabled: boolean;
  onProgress: (progress: number) => void;
}) {
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
        className="btn primary"
        onClick={() => {
          if (progress >= 1) {
            setProgress(0);
            onProgress(0);
            progressRef.current = 0;
          }
          setPlaying((p) => !p);
        }}
      >
        {playing ? "Pause" : progress >= 1 ? "Replay" : "Play"}
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
