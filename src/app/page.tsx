"use client";

import Link from "next/link";
import { getTodaysPrompt } from "@/lib/prompts";

export default function Home() {
  const prompt = getTodaysPrompt();

  return (
    <main className="hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="hero-art"
        src="/brand/littlest-things.png"
        alt=""
        aria-hidden
      />
      <div className="hero-inner">
        <p className="hero-brand">The Little Things</p>
        <h1>
          Today, notice <em>{prompt}</em>.
        </h1>
        <p>
          Spot it in the world, take a photo, leave a pin. Friends see your
          path — strangers only see the finds.
        </p>
        <div className="cta-row">
          <Link href="/check-in" className="btn primary">
            Spot it
          </Link>
          <Link href="/city" className="btn ghost">
            City finds
          </Link>
        </div>
      </div>
    </main>
  );
}
