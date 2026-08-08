"use client";

import { useEffect, useMemo, useState } from "react";
import SphereImageGrid, {
  type ImageData,
} from "@/components/ui/img-sphere";
import { getAllCheckins } from "@/lib/api";

/** Known-good Unsplash fills so the sphere looks full before city photos load. */
const FALLBACK_BASE: Omit<ImageData, "id">[] = [
  {
    src: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=640&q=80",
    alt: "Mountain lake",
    title: "Little views",
  },
  {
    src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=640&q=80",
    alt: "Sunlit forest",
    title: "Soft light",
  },
  {
    src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=640&q=80",
    alt: "Forest path",
    title: "Quiet path",
  },
  {
    src: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=640&q=80",
    alt: "Foggy hills",
    title: "Morning haze",
  },
  {
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=80",
    alt: "Coast cliffs",
    title: "Edge of town",
  },
  {
    src: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=640&q=80",
    alt: "Green field",
    title: "Open field",
  },
  {
    src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=640&q=80",
    alt: "Starry peaks",
    title: "Night finds",
  },
  {
    src: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=640&q=80",
    alt: "Desert dunes",
    title: "Warm grain",
  },
  {
    src: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=640&q=80",
    alt: "Woodland bridge",
    title: "Crossing",
  },
  {
    src: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?auto=format&fit=crop&w=640&q=80",
    alt: "Misty trees",
    title: "Soft edges",
  },
  {
    src: "https://images.unsplash.com/photo-1426604966842-b8b6c2c37f2b?auto=format&fit=crop&w=640&q=80",
    alt: "Mountain meadow",
    title: "Wide open",
  },
  {
    src: "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&w=640&q=80",
    alt: "Ocean shore",
    title: "Tide line",
  },
];

const TARGET_COUNT = 48;

function padImages(seed: ImageData[]): ImageData[] {
  if (seed.length === 0) {
    return Array.from({ length: TARGET_COUNT }, (_, i) => {
      const base = FALLBACK_BASE[i % FALLBACK_BASE.length];
      return {
        id: `fallback-${i}`,
        ...base,
        alt: `${base.alt} (${Math.floor(i / FALLBACK_BASE.length) + 1})`,
      };
    });
  }

  const out: ImageData[] = [...seed];
  let i = 0;
  while (out.length < TARGET_COUNT) {
    const base = FALLBACK_BASE[i % FALLBACK_BASE.length];
    out.push({
      id: `pad-${i}`,
      ...base,
      alt: `${base.alt} pad`,
    });
    i += 1;
  }
  return out.slice(0, TARGET_COUNT);
}

function fallbackImages(): ImageData[] {
  return padImages([]);
}

export function AppLoadingScreen() {
  const [images, setImages] = useState<ImageData[]>(fallbackImages);
  const [containerSize, setContainerSize] = useState(420);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setContainerSize(Math.round(Math.min(560, w - 32, h - 160)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAllCheckins()
      .then((rows) => {
        if (cancelled) return;
        const city: ImageData[] = rows
          .filter((c) => Boolean(c.photo_url))
          .slice(-TARGET_COUNT)
          .map((c, i) => ({
            id: c.id || `city-${i}`,
            src: c.photo_url,
            alt: c.caption || c.prompt || "City find",
            title: c.prompt ?? undefined,
            description: c.caption ?? undefined,
          }));
        if (city.length > 0) setImages(padImages(city));
      })
      .catch(() => {
        /* keep fallbacks */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sphereRadius = useMemo(
    () => Math.round(containerSize * 0.38),
    [containerSize],
  );

  return (
    <main className="app-loading-screen" aria-busy="true" aria-live="polite">
      <div className="app-loading-copy">
        <p className="panel-kicker">the little things</p>
        <h1>Gathering finds…</h1>
        <p className="meta">Drag the sphere — everyone&apos;s noticing.</p>
      </div>
      <SphereImageGrid
        images={images}
        containerSize={containerSize}
        sphereRadius={sphereRadius}
        dragSensitivity={0.8}
        momentumDecay={0.96}
        maxRotationSpeed={6}
        baseImageScale={0.14}
        hoverScale={1.25}
        perspective={1000}
        autoRotate
        autoRotateSpeed={0.22}
        className="app-loading-sphere"
      />
    </main>
  );
}
