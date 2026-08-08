# The Little Things
A summery, whimsical app for noticing life's small joys.

Every day, everyone gets the same prompt — something small to notice
("purple", "cool sneakers", "wings"). When you spot it, take a photo.
It pins where you are. Little things, shared.

## Quick start

```bash
npm install
cp .env.example .env.local
# Optional but recommended:
#   NEXT_PUBLIC_MAPBOX_TOKEN=pk....
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Without Supabase:** the app uses localStorage. On **Friends**, click **Load demo paths**, then open the friends map / city / pulse pages.

**With Supabase:** run `supabase/schema.sql` in the SQL editor, fill `.env.local`, then `npm run seed`.

### Routes
| Route | Feature |
| --- | --- |
| `/` | Today's prompt + entry |
| `/check-in` | Photo + location for today's prompt |
| `/path` | Your day as a connected path |
| `/friends` | Add friends · see their paths |
| `/city` | Public map of individual finds (no identity links) |
| `/dashboard` | City intelligence / Pulse |

---

## The Core Idea
Everyone wakes up to the **same daily prompt** — a small thing to notice
in the world. Whenever you see it, you check in with one photo; the app
pins that moment to your location.

- **You** see your own day's finds connected into a **path** — a rough
  trace of where you went while hunting the prompt.
- **Friends** can see each other's paths (colored lines linking their photos
  in time order).
- **Strangers** only see **individual pins** on the public city map. If you
  posted three times today, a stranger cannot tell those three photos came
  from the same person. No circle, no group blob — just finds.

The point is not tracking yourself. It's noticing the little things —
and sharing that noticing with people you choose.

---

## Visibility rules

| Viewer | Sees |
| --- | --- |
| You | Your photos connected as a path |
| A friend | Your path (line + pins) for today |
| A stranger / city | Only isolated photo pins — never who posted, never a line linking one person's stops |

---

## Components

### 1. Daily Prompt
**What it does:** At the start of each day, every user sees the same prompt
word or phrase (e.g. "purple", "cool sneakers", "wings"). The prompt drives
what people look for and photograph.
**Owns:** Prompt calendar / generator, home + check-in surface copy.
**Tech:** Deterministic day → prompt map (or seeded list) so everyone shares
the same prompt without a server round-trip.
**Priority:** Build first alongside check-in — the product loop needs it.

### 2. Check-In Flow
**What it does:** User taps "check in," takes one photo (camera or upload)
of today's prompt in the wild, optional caption, submits with location.
**Owns:** Camera capture UI, geolocation grab, upload to storage, insert row.
**Tech:** Next.js page/component, `getUserMedia` or native `<input capture>`,
`browser-image-compression`, Supabase JS client.
**Depends on:** Supabase Storage + `checkins` table existing.
**Priority:** Build with the prompt. Nothing else works without this.

### 3. Anonymous Identity / Friends
**What it does:** No accounts — device-based anonymous ID generated on first
load (localStorage). Friends are pairwise: share a code/link; accepting tags
your device as friends with theirs. There is **no circle / group**.
**Owns:** Device ID generation, friend codes, friend list, friendship table.
**Tech:** Supabase table `friendships` (or local store). UUID stored client-side.
**Priority:** Build after check-in works standalone.

### 4. Personal Day Path (single user)
**What it does:** Pulls all of one device's check-ins for today, orders by
timestamp, draws a connecting line + photo pins on the map.
**Owns:** Map rendering (single line), photo pin markers, timestamp labels.
**Tech:** Mapbox GL JS / `react-map-gl`, a Supabase query filtered by
`device_id` and today's date.
**Priority:** Build next. This is your minimum viable demo of "my hunt today."

### 5. Friends' Paths
**What it does:** For each friend, pull today's check-ins and draw their path
in a distinct color on one shared map — so you can see roughly where they
went while chasing the prompt.
**Owns:** Color assignment per friend, multi-line rendering, legend UI.
**Tech:** Mapbox multi-layer line rendering, queries for friend `device_id`s.
**Priority:** Core social moment. Replaces the old circle/group map.

### 6. Public City Layer (stranger view)
**What it does:** A public, no-login page showing every find in the city
today as **individual pins** — photos on the map, no paths, no names, no
way to tell which pins belong to the same stranger. This is what makes the
project legible to anyone and eligible for Main Track.
**Owns:** City map view that deliberately does **not** group by `device_id`
when drawing lines (pins only; identity stripped).
**Tech:** Same Mapbox setup, unauthenticated query — select check-ins, strip
device info before render, never connect stranger pins into paths.
**Priority:** Don't skip — this is the privacy-preserving public layer.

### 7. Path Replay ("Course Path" feature)
**What it does:** Animate a friend's (or your) path drawing itself over
time — Strava-style replay. Applies to personal and friends views only
(not city pins).
**Owns:** Animation loop revealing path segment-by-segment by timestamp.
**Tech:** Mapbox `LineLayer` with progressively updated `data`.
**Priority:** Polish — after 1–6 work. Cut first if time runs short.

### 8. Data Intelligence Dashboard
**What it does:** Aggregate, city-level stats — busiest check-in times,
densest areas, how many finds today, where the prompt showed up most.
**Owns:** Dashboard page, aggregate queries, chart/heatmap rendering.
**Tech:** Recharts, Mapbox heatmap, Supabase aggregates.
**Priority:** TECHNATION deliverable — after the core loop works.

### 9. Reve Visual Assets
**What it does:** Brand visuals — map markers, path styling, onboarding,
prompt cards, dashboard backgrounds.
**Owns:** Static image/SVG assets only.
**Tech:** Reve as a design tool (not a runtime API).
**Priority:** Parallel throughout the build.

### 10. Seeding Script
**What it does:** Fake check-ins (real venue coordinates) so the demo map
isn't empty — several friends' paths plus many stranger pins for the city.
**Owns:** One-off script / in-app demo loader.
**Tech:** Node script or SQL against Supabase; localStorage demo button.
**Priority:** Near the end, before rehearsal.

---

## Build Order Summary
1. Daily prompt + check-in (camera + upload + save)
2. Anonymous ID + friends (no circle)
3. Personal day path (connected line)
4. Friends' paths — **core social demo**
5. Public city pins (unlinked) — **Main Track / stranger privacy**
6. Path replay (friends / self only)
7. Data dashboard (TECHNATION)
8. Reve assets (parallel)
9. Seed data (before rehearsal)

## Non-Negotiables
- Check-ins are **opt-in, never forced on a timer.** No hourly push-lock, no
  penalty for skipping. Spot the prompt when you spot it.
- Every check-in requires a **photo** of today's prompt in the world.
- **No circle / group.** Social graph is friends only.
- On the **city / stranger layer**, pins must stay **unlinked** — never draw
  a path that reveals which photos belong to the same unknown person.
- The **public city layer must exist** and be visitable with no account and
  no friends. That keeps this a real Main Track product, not a private
  friends-only app.
