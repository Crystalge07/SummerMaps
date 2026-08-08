# Pathline
Every check-in is a photo and a place. Every day is a path.
See your day — and your friends' days — as one shared story.

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

**Without Supabase:** the app uses localStorage. On **Circle**, click **Load demo paths**, then open the group map / city / pulse pages.

**With Supabase:** run `supabase/schema.sql` in the SQL editor, fill `.env.local`, then `npm run seed`.

### Routes
| Route | Feature |
| --- | --- |
| `/check-in` | Photo + location check-in |
| `/path` | Personal day path + replay |
| `/group` | Create / join anonymous circle |
| `/group/map` | Multi-color group paths + crossings |
| `/city` | Public anonymized city layer |
| `/dashboard` | City intelligence / Pulse |

---

## The Core Idea
Check in whenever you want (aim for ~hourly, never forced) with one photo.
At any point, your day's check-ins connect into a path on a map.
Friends in your circle render as different colored paths on the same map —
watch your day cross theirs, or not.
Underneath it all, a public layer shows the whole city's paths, anonymized —
this is what makes it a real Main Track submission, not just a friend group app.

---

## Components

### 1. Check-In Flow
**What it does:** User taps "check in," takes one photo (camera or upload),
optional caption, submits.
**Owns:** Camera capture UI, geolocation grab, upload to storage, insert row.
**Tech:** Next.js page/component, `getUserMedia` or native `<input capture>`,
`browser-image-compression`, Supabase JS client.
**Depends on:** Supabase Storage + `checkins` table existing.
**Priority:** Build first. Nothing else works without this.

### 2. Anonymous Identity / Friend Groups
**What it does:** No accounts — device-based anonymous ID generated on first
load (localStorage). Friend groups are a shareable join code/link; joining a
group just tags your device ID with a group ID.
**Owns:** Device ID generation, group creation, group join flow, group membership table.
**Tech:** Supabase table `groups`, `group_members`. UUID stored client-side.
**Priority:** Build second, right after check-in flow works standalone.

### 3. Personal Day Path (single user)
**What it does:** Pulls all of one device's check-ins for today, orders by
timestamp, draws a connecting line + photo pins on the map.
**Owns:** Map rendering (single line), photo pin markers, timestamp labels.
**Tech:** Mapbox GL JS / `react-map-gl`, a Supabase query filtered by
`device_id` and today's date.
**Priority:** Build third. This is your minimum viable demo.

### 4. Multi-User Colored Paths (the group view)
**What it does:** Given a group ID, pulls every member's check-ins for today,
draws each person's path in a distinct color on one shared map.
**Owns:** Color assignment per user, multi-line rendering, legend UI,
"paths crossed here" detection (optional stretch: flag where/when two paths
were spatially and temporally close).
**Tech:** Mapbox multi-layer line rendering, a Supabase query grouped by
`device_id` within a `group_id`.
**Priority:** Build fourth. This is your actual demo centerpiece — the
"watch our day happen together" moment.

### 5. Public City Layer (Main Track requirement)
**What it does:** A public, no-login page showing every check-in in the city
today as anonymized colored lines — no names, no group info, just the shape
of the whole city's movement. This is what makes the project legible to a
stranger and eligible for the Main Track.
**Owns:** A separate map view, pulling all `checkins` regardless of group,
rendered without any identity attached.
**Tech:** Same Mapbox setup as #4, different (unauthenticated) query —
select all check-ins, strip device/group info before rendering.
**Priority:** Build fifth, but don't skip it — this is the piece that makes
the whole project legitimate for judging, not optional polish.

### 6. Path Replay ("Course Path" feature)
**What it does:** Instead of showing the full day's path as a static line,
animate it drawing itself in over time — Strava's route-replay effect.
Applies to both personal and group views.
**Owns:** A simple animation loop that reveals the path segment-by-segment
based on check-in timestamps.
**Tech:** Mapbox `LineLayer` with a progressively updated `data` prop, driven
by a `requestAnimationFrame` or timed interval.
**Priority:** Build sixth. This is a polish feature — real demo impact, but
only after 1–5 work. Cut first if time runs short.

### 7. Data Intelligence Dashboard
**What it does:** Aggregate, city-level stats surfaced visually — busiest
check-in times, densest areas, how many paths crossed today, city-wide
movement patterns.
**Owns:** A dashboard page, a few aggregate SQL queries, chart/heatmap rendering.
**Tech:** Recharts for charts, Mapbox `heatmap-layer` for density, direct
Supabase aggregate queries (`GROUP BY`, `COUNT`).
**Priority:** Build seventh. This is your TECHNATION track deliverable —
needed, but only after the core loop actually works.

### 8. Reve Visual Assets
**What it does:** All the illustrated, brand-defining visuals — map marker
icons, path styling reference, onboarding illustration, dashboard chart
backgrounds, group creation flow art.
**Owns:** Static image/SVG assets only — generated ahead of time, not called
live at runtime.
**Tech:** Reve (used as a design tool during downtime, not an API
integration in the app itself).
**Priority:** Run in parallel the entire build, starting hour 1. Whoever
isn't needed for backend/core loop should be generating these continuously.

### 9. Seeding Script
**What it does:** Generates realistic fake check-ins (with real venue
coordinates) so the demo map isn't empty. Should include several distinct
"paths" across a few hours so the group view has something to show
immediately.
**Owns:** A one-off script/SQL insert batch, run before the demo, not part
of the live app.
**Tech:** Plain Node script or SQL insert statements against Supabase.
**Priority:** Build in the last few hours, but plan the data you'll need
(which venue spots, how many fake users) well before then.

---

## Build Order Summary
1. Check-in flow (camera + upload + save)
2. Anonymous ID + groups
3. Personal day path (single line on map)
4. Multi-user colored group paths — **this is the core demo moment**
5. Public city layer — **this is what makes it Main Track eligible, don't skip**
6. Path replay animation (polish)
7. Data dashboard (TECHNATION deliverable)
8. Reve assets (parallel, throughout)
9. Seed data (near the end, before rehearsal)

## Non-Negotiables
- Check-ins are **opt-in, never forced on a timer.** No hourly push-lock, no
penalty for skipping an hour. This avoids the surveillance criticism outright.
- The **public city layer must exist and must be genuinely visitable by
someone with no account and no group.** This is the difference between a
Main Track submission and a private group chat app.
- Every check-in requires a **photo.** That's the literal human-input
requirement — don't let this quietly become location-only.
