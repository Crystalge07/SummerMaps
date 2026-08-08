"use client";

import Link from "next/link";
import { getTodaysPrompt } from "@/lib/prompts";

export default function Home() {
  const prompt = getTodaysPrompt();

  return (
    <main className="hero">
      <div className="hero-stage" aria-hidden>
        <div className="hero-orb hero-orb-a" />
        <div className="hero-orb hero-orb-b" />
        <div className="hero-vinyl hero-vinyl-a" />
        <div className="hero-vinyl hero-vinyl-b" />
        <div className="hero-squiggle" />
      </div>
      <div className="hero-inner">
        <p className="hero-brand">
          The Little
          <br />
          Things
        </p>
        <h1>
          Today, notice <em>{prompt}</em>.
        </h1>
        <p>
          Spot it in the world, take a photo, leave a pin. Friends see the path
          of your day — strangers only see the finds.
        </p>
        <div className="cta-row">
          <Link href="/check-in" className="btn primary">
            Spot it
          </Link>
          <Link href="/city" className="btn ghost">
            Wander the city
          </Link>
        </div>
      </div>
      <div className="hero-notes" aria-hidden>
        <span className="note note-a" />
        <span className="note note-b" />
        <span className="note note-c" />
      </div>
    </main>
  );
}
