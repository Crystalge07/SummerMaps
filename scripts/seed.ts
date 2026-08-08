/**
 * Seed realistic Toronto venue check-ins for demo paths.
 *
 * Usage:
 *   - With Supabase: set env vars, then `npm run seed`
 *   - Without: use the in-app "Load demo paths" button on Friends
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

const friends = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alex",
    stops: [0, 1, 2, 11],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Sam",
    stops: [4, 5, 6, 7],
  },
];

const strangers = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    stops: [10, 9, 8, 7],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    stops: [3, 4, 0, 10],
  },
];

function friendCode(deviceId: string) {
  return deviceId.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function todayAt(hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dayPrompt() {
  const prompts = [
    "purple",
    "cool sneakers",
    "wings",
    "something yellow",
    "handwritten signs",
  ];
  const key = new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return prompts[h % prompts.length];
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
  const prompt = dayPrompt();
  const people = [...friends, ...strangers];

  const profiles = people.map((t) => ({
    device_id: t.id,
    code: friendCode(t.id),
    display_name: "name" in t ? t.name : null,
    created_at: new Date().toISOString(),
  }));

  const checkins = people.flatMap((t, travelerIdx) =>
    t.stops.map((venueIdx, stopIdx) => {
      const venue = venues[venueIdx];
      return {
        id: crypto.randomUUID(),
        device_id: t.id,
        prompt,
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
    console.log(
      "No Supabase env — use Friends → Load demo paths in the app for localStorage seed.",
    );
    console.log(
      `Would seed ${checkins.length} finds for prompt "${prompt}". Friend codes: ${friends.map((f) => friendCode(f.id)).join(", ")}`,
    );
    return;
  }

  const supabase = createClient(url, key);

  await supabase.from("device_profiles").upsert(profiles);
  await supabase
    .from("checkins")
    .delete()
    .in(
      "device_id",
      people.map((p) => p.id),
    );
  const { error } = await supabase.from("checkins").insert(checkins);
  if (error) throw error;

  console.log(
    `Seeded ${checkins.length} finds for prompt "${prompt}". Friend codes: ${friends.map((f) => friendCode(f.id)).join(", ")}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
