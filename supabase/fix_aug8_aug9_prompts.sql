-- Retag check-in prompts around the Aug 8 → Aug 9 10pm ET day boundary.
-- UI already derives the theme from created_at; this fixes stored snapshots
-- (e.g. "old stickers", "hidden beauty") for consistency.
--
-- Run in the Supabase SQL editor.
--
-- Aug 8 mosaic window: 2026-08-07 22:00 ET → 2026-08-08 22:00 ET
-- Aug 9 mosaic window: 2026-08-08 22:00 ET → 2026-08-09 22:00 ET
-- (ET is EDT in August → UTC-4)

-- Warmth: everything in the Aug 8 mosaic window
update checkins
set prompt = 'warmth'
where created_at >= '2026-08-08 02:00:00+00'
  and created_at <  '2026-08-09 02:00:00+00';

-- Hidden beauties: everything in the Aug 9 mosaic window
-- (includes late Aug 8 after 10pm ET that still say old stickers / hidden beauty)
update checkins
set prompt = 'hidden beauties'
where created_at >= '2026-08-09 02:00:00+00'
  and created_at <  '2026-08-10 02:00:00+00';
