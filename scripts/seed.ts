/**
 * Seed realistic Toronto venue check-ins for demo paths.
 *
 * Usage:
 *   - With Supabase: set env vars, then `npm run seed`
 *   - Without: prints JSON you can paste, or use the in-app "Load demo paths" button
 */
import { createClient } from "@supabase/supabase-js";

const venues = [
  { name: "Union Station", lat: 43.6453, lng: -79.3806 },
  { name: "St. Lawrence Market", lat: 43.6487, lng: -79.3715 },
  { name: "Distillery District", lat: 43.6503, lng: -79.3595 },
  { name: "Harbourfront", lat: 43.6387, lng: -79.3816 },
  { name: "CN Tower", lat: 43.6426, lng: -79.3871 },
  { name: "Rogers Centre", lat: 43.6414, lng: -79.3894 },
  { name: "Queen West", lat: 43.6488, lng: -79.3975 },
  { name: "Kensington", lat: 43.6548, lng: -79.4005 },
  { name: "U of T", lat: 43.6629, lng: -79.3957 },
  { name: "Yorkville", lat: 43.6701, lng: -79.3936 },
  { name: "Yonge-Dundas", lat: 43.6561, lng: -79.3802 },
  { name: "Cabbagetown", lat: 43.6662, lng: -79.3634 },
];

const travelers = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    color: "#E85D4C",
    stops: [0, 1, 2, 11],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    color: "#1F8A70",
    stops: [4, 5, 6, 7],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    color: "#F4A261",
    stops: [10, 9, 8, 7],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    color: "#3D5A80",
    stops: [3, 4, 0, 10],
  },
];

function todayAt(hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const placeholderPhoto =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#1F8A70"/><stop offset="1" stop-color="#E85D4C"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="52%" fill="white" font-size="42" font-family="Arial" text-anchor="middle">Pathline</text>
    </svg>`,
  );

async function main() {
  const groupId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const group = {
    id: groupId,
    code: "DEMO01",
    name: "Demo Circle",
    created_at: new Date().toISOString(),
  };

  const members = travelers.map((t) => ({
    id: crypto.randomUUID(),
    group_id: groupId,
    device_id: t.id,
    display_color: t.color,
    joined_at: new Date().toISOString(),
  }));

  const checkins = travelers.flatMap((t, travelerIdx) =>
    t.stops.map((venueIdx, stopIdx) => {
      const venue = venues[venueIdx];
      return {
        id: crypto.randomUUID(),
        device_id: t.id,
        group_id: groupId,
        lat: venue.lat + (Math.random() - 0.5) * 0.001,
        lng: venue.lng + (Math.random() - 0.5) * 0.001,
        photo_url: placeholderPhoto,
        caption: `${venue.name}`,
        created_at: todayAt(9 + travelerIdx + stopIdx * 2, stopIdx * 12),
      };
    }),
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log("No Supabase env — writing scripts/seed-local.json for in-app import.");
    const fs = await import("node:fs");
    fs.writeFileSync(
      "scripts/seed-local.json",
      JSON.stringify({ group, members, checkins }, null, 2),
    );
    console.log(`Wrote ${checkins.length} check-ins for group code DEMO01`);
    return;
  }

  const supabase = createClient(url, key);

  await supabase.from("groups").upsert(group);
  await supabase.from("group_members").upsert(members);
  await supabase.from("checkins").delete().eq("group_id", groupId);
  const { error } = await supabase.from("checkins").insert(checkins);
  if (error) throw error;

  console.log(`Seeded ${checkins.length} check-ins. Join code: DEMO01`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
