# The Little Things

> *Capture the little joys in life. Share them with the world.*

**Live:** https://summer-maps.vercel.app  
**Built at:** SummerHacks 2026 

---

## What It Is

The Little Things is a daily photo check-in app where one honest 
moment — one photo, one place — becomes a permanent pin on a shared, 
growing map of your city.

Every day has a prompt. You spot something that fits it. Your photo 
lands on the map. Friends see your path. Strangers see the city come 
alive. The data tells a story about how a city moves, notices, and 
connects.

---

## Hackathon Tracks

### 🏆 Main — Summerhacks
One moment of human input (a photo + location) gets transformed into 
a permanent pin on a shared, public, growing map. Every check-in is 
visible to anyone. The city layer shows the collective map of what 
everyone noticed today.

### 🎨 Reve — Best Visual Identity
Every illustration, map marker, background, and brand element was 
built with Reve. Warm parchment palette, hand-illustrated field-note 
aesthetic, Playfair Display typography. Nothing looks like a generic 
AI-generated frontend.

### 📊 TECHNATION — Data Intelligence
Every check-in generates real data: location, time, path, density, 
crossings. Surfaced visually in Insights — live feed, hourly 
distribution charts, densest neighborhoods, heatmap layer. Not 
silently logged. Actually explorable.

---

## Features

**Check-in**
- Daily shared prompt (resets at 10PM ET)
- One photo, one place — camera or upload
- Reverse geocoding: pins show real neighborhood names
- Optional caption
- Geolocation with Safari + Chrome support
- Graceful denial/timeout handling — never fakes a location

**Map**
- Personal day path in your assigned color
- Friends' paths as distinct colored lines
- Public city layer: anonymous unlinked pins from everyone
- Path replay: chronological animation, line draws to each 
  destination, photo pin expands on arrival
- Paths/Heat toggle
- Crossing detection: friend crossings shown as map dots with 
  popup, stranger crossings counted and surfaced as a banner

**Friends**
- Add friends by username (unique, enforced)
- Shareable profile link + Web Share API
- Per-friend crossing summaries (📍 1–4 times, 🔥 5+ times)
- Remove friends

**Insights**
- Live feed: 3 most recent captures with real usernames + location
- See all captures sheet
- Hourly distribution chart
- 14-day growth chart
- Densest neighborhood cards
- Heatmap layer on city map

**Profile**
- Optional email/password auth (sync across devices)
- Anonymous device-based identity (no account required)
- Daily mosaic of today's photos + past mosaics archive
- Activity stats, share section, friends entry

**Technical**
- localStorage offline fallback when Supabase unconfigured
- Demo seed for judging/testing
- Click + shutter sounds

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3, React 19, TypeScript |
| Styling | Tailwind CSS 4, CSS variables |
| Database | Supabase (Postgres + Auth + Storage) |
| Maps | Mapbox GL JS, react-map-gl |
| Charts | Recharts |
| Design | Reve (illustrations + brand identity) |
| Fonts | Playfair Display, Nunito |
| Hosting | Vercel |

---

## Running Locally

```bash
git clone https://github.com/Crystalge07/TheLittleThings
cd TheLittleThings
npm install
```

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

```bash
npm run dev
```

Open http://localhost:3000. No account required — the app works 
anonymously on first load.

> **Without Supabase env vars:** the app runs in localStorage mode. 
> Check-ins, friends, and paths are device-local only. Use 
> "Load demo paths" on the Friends page to see the full experience.

---

## Database Schema

```sql
device_profiles  — anonymous device identity, username, color
friendships      — pairwise friend graph (a_device_id < b_device_id)
checkins         — photo_url, lat, lng, caption, location_name, prompt
profiles         — optional email/password auth (username, created_at)
```

Storage bucket: `checkins` (public, photo uploads)

---

## Team

Built at SummerHacks 2026 in 24 hours.
