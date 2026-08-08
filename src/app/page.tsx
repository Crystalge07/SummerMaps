import Link from "next/link";

export default function Home() {
  return (
    <main className="hero">
      <div className="hero-inner">
        <p className="hero-brand">Pathline</p>
        <h1>Every check-in is a photo and a place.</h1>
        <p>
          See your day — and your friends&apos; days — as one shared story on a
          map. The public city layer shows the movement of everyone, anonymized.
        </p>
        <div className="cta-row">
          <Link href="/check-in" className="btn primary">
            Check in
          </Link>
          <Link href="/city" className="btn ghost">
            Watch the city
          </Link>
        </div>
      </div>
    </main>
  );
}
