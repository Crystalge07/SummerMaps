# The Little Things
A summery, whimsical app for noticing life's small joys.

Every day, everyone gets the same prompt — something small to notice
("purple", "cool sneakers", "warmth"). When you spot it, take a photo.
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
| `/` | Home — today's prompt + camera check-in |
| `/map` | Map — city pins; Paths toggle for Mine / Friends |
| `/insights` | City intelligence — live activity, growth, themes, mood |
| `/profile` | Account, friends, and shared daily mosaics / memories |
| `/friends` | Add friends by username · share codes (from Profile) |
| `/capture`, `/check-in`, `/path`, `/city`, `/dashboard`, `/friends/map` | Redirect into the tabs above |

---

## The Core Idea
Everyone shares the **same daily prompt** — a small thing to notice
in the world. Whenever you see it, you check in with one photo; the app
pins that moment to your location.

- **You** see your own day's finds connected into a **path** — a rough
  trace of where you went while hunting the prompt.
- **Friends** can see each other's paths (colored lines linking their photos
  in time order).
- **Strangers** only see **individual pins** on the public city map. If you
  posted three times today, a stranger cannot tell those three photos came
  from the same person. No circle, no group blob — just finds.
- The city also builds a **shared mosaic** each day — a collage of everyone's
  photos that locks when the day rolls over.

The point is not tracking yourself. It's noticing the little things —
and sharing that noticing with people you choose.

---

## Daily rhythm (prompts + mosaics)

Mosaic days use **America/New_York** time and roll at **10pm ET**, not
midnight.

| Window | Belongs to |
| --- | --- |
| From previous day 10pm ET → this day 10pm ET | Today's prompt, map "today", and live mosaic |
| At/after 10pm ET | Next calendar day's prompt, map, and mosaic |

- Prompt source: `src/lib/prompts.ts` (rotating list + per-day overrides).
- Mosaic grouping / lock: `src/lib/mosaic.ts` (same `dayKey` as prompts).
- New check-ins snapshot the active prompt at capture time.

Example: a find at 10:30pm ET on Aug 8 is part of Aug 9's map and mosaic.

---

## Visibility rules

| Viewer | Sees |
| --- | --- |
| You | Your photos connected as a path |
| A friend | Your path (line + pins) for today |
| A stranger / city | Only isolated photo pins — never who posted, never a line linking one person's stops |

---

## Identity & friends

- **Local / offline mode:** anonymous device ID in localStorage (no login).
- **Supabase mode:** email + password auth, public **username**, and
  friend requests by username. Device profiles + pairwise friendships still
  power the social graph — there is **no circle / group**.

---

## Components

### 1. Daily Prompt
**What it does:** Everyone sees the same prompt for the current mosaic day
(word or phrase such as "purple", "cool sneakers", "hidden beauties").
**Owns:** Prompt list, day-key overrides, home + check-in copy.
**Tech:** `dayKey` in ET with a 10pm rollover; optional `PROMPT_OVERRIDES`
for specific dates. No server round-trip to know today's prompt.

### 2. Check-In Flow
**What it does:** User takes one photo (camera or upload) of today's prompt
in the wild, optional caption / place name, submits with location.
**Owns:** Camera capture UI, geolocation, upload to storage, insert row.
**Tech:** Next.js, `browser-image-compression`, Supabase JS (or localStore).

### 3. Identity / Friends
**What it does:** Pairwise friends via username request or friend code.
Accepting connects devices so paths can be shared. No circles or groups.
**Owns:** Auth gate, usernames, friend requests, friendship table / local store.
**Tech:** Supabase Auth + `profiles` / `friend_requests` / `friendships`, or
localStorage demo mode.

### 4. Personal Day Path (single user)
**What it does:** Pulls one device's check-ins for the current mosaic day,
orders by time, draws a connecting line + photo pins.
**Tech:** Mapbox GL / `react-map-gl`, filtered by `device_id` and today's
10pm–10pm ET window.

### 5. Friends' Paths
**What it does:** For each friend, draw today's path in a distinct color on
one shared map.
**Tech:** Multi-layer Mapbox lines, friend `device_id` queries, path replay
controls for polish.

### 6. Public City Layer (stranger view)
**What it does:** Every find today as **individual pins** — no paths, no
names, no way to tell which pins belong to the same stranger.
**Tech:** Same Mapbox setup; deliberately does not group strangers by
`device_id` when drawing.

### 7. Shared Daily Mosaic
**What it does:** City-wide collage of every photo from the mosaic day.
Live until 10pm ET, then locked under Memories / past mosaics on Profile.
**Tech:** `buildMosaicDays` groups by ET `dayKey`; full-screen `MosaicView`.

### 8. Insights / City Intelligence
**What it does:** Aggregate stats — busiest times, densest areas, themes,
recent activity.
**Tech:** Recharts + client-side aggregates over check-ins.

### 9. Seeding
**What it does:** Fake check-ins (real venue coordinates) so demos aren't
empty — friends' paths plus stranger pins.
**Tech:** `npm run seed` against Supabase; in-app **Load demo paths** for
localStorage.

---

## Stack

- **Next.js 16** + React 19 + TypeScript + Tailwind
- **Mapbox** (`react-map-gl`) for maps and paths
- **Supabase** Postgres + Storage (+ Auth when configured)
- Falls back to **localStorage** when Supabase env vars are missing

Schema: `supabase/schema.sql` (`device_profiles`, `checkins`, `friendships`,
`friend_requests`, auth `profiles`, public `checkins` storage bucket).

---

## Non-Negotiables
- Check-ins are **opt-in, never forced on a timer.** No hourly push-lock, no
  penalty for skipping. Spot the prompt when you spot it.
- Every check-in requires a **photo** of today's prompt in the world.
- **No circle / group.** Social graph is friends only.
- On the **city / stranger layer**, pins must stay **unlinked** — never draw
  a path that reveals which photos belong to the same unknown person.
- The **public city layer must exist** and be visitable with no account and
  no friends. That keeps this a real public product, not a private
  friends-only app.
