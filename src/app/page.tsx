"use client";

import Link from "next/link";
import { getTodaysPrompt } from "@/lib/prompts";

export default function Home() {
  const prompt = getTodaysPrompt();

  return (
    <main className="hero">
      <div className="hero-inner">
        <p className="hero-brand">Pathline</p>
        <h1>
          Today, notice <em>{prompt}</em>.
        </h1>
        <p>
          Everyone gets the same prompt. When you spot it, take a photo — it
          pins where you are. Friends see your path; strangers only see
          individual finds.
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
