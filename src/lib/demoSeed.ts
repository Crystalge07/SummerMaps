"use client";

import { friendCodeFromDeviceId } from "./friendCode";
import { getDeviceId } from "./device";
import { localStore } from "./localStore";
import { getTodaysPrompt } from "./prompts";
import type { CheckIn, DeviceProfile, Friendship } from "./types";

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

/** Demo friends — connected paths for the friends map. */
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

/** Stranger finds — city pins only; never friended to the viewer. */
const strangers = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    stops: [10, 9, 8],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    stops: [3, 4, 0],
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3F7A4C"/><stop offset="1" stop-color="#E56B3A"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="52%" fill="white" font-size="36" font-family="Georgia, serif" text-anchor="middle">little things</text></svg>`,
  );

function makeCheckins(
  travelers: { id: string; stops: number[] }[],
  prompt: string,
): CheckIn[] {
  return travelers.flatMap((t, travelerIdx) =>
    t.stops.map((venueIdx, stopIdx) => {
      const venue = venues[venueIdx];
      return {
        id: crypto.randomUUID(),
        device_id: t.id,
        prompt,
        lat: venue.lat + (Math.random() - 0.5) * 0.001,
        lng: venue.lng + (Math.random() - 0.5) * 0.001,
        photo_url: placeholderPhoto,
        caption: venue.name,
        created_at: todayAt(9 + travelerIdx + stopIdx * 2, stopIdx * 12),
      };
    }),
  );
}

export async function loadLocalDemoSeed() {
  const prompt = getTodaysPrompt();
  const me = getDeviceId();
  const allDemoIds = [...friends, ...strangers].map((t) => t.id);

  const profiles: DeviceProfile[] = [
    {
      device_id: me,
      code: friendCodeFromDeviceId(me),
      display_name: "You",
      created_at: new Date().toISOString(),
    },
    ...friends.map((t) => ({
      device_id: t.id,
      code: friendCodeFromDeviceId(t.id),
      display_name: t.name,
      created_at: new Date().toISOString(),
    })),
    ...strangers.map((t) => ({
      device_id: t.id,
      code: friendCodeFromDeviceId(t.id),
      display_name: null,
      created_at: new Date().toISOString(),
    })),
  ];

  const friendships: Friendship[] = friends.map((t) => {
    const [a, b] = me < t.id ? [me, t.id] : [t.id, me];
    return {
      id: crypto.randomUUID(),
      a_device_id: a,
      b_device_id: b,
      created_at: new Date().toISOString(),
    };
  });

  const checkins = [
    ...makeCheckins(friends, prompt),
    ...makeCheckins(strangers, prompt),
  ];

  const existingCheckins = await localStore.getAllCheckins();
  const demoIdSet = new Set(allDemoIds);
  const keptCheckins = existingCheckins.filter(
    (c) => !demoIdSet.has(c.device_id),
  );
  const existingProfiles = (await localStore.listProfiles()).filter(
    (p) => p.device_id === me || !demoIdSet.has(p.device_id),
  );
  const existingFriendships = (await localStore.listFriendships()).filter(
    (f) =>
      !demoIdSet.has(f.a_device_id) && !demoIdSet.has(f.b_device_id),
  );

  // Dedupe "me" profile
  const profileMap = new Map<string, DeviceProfile>();
  for (const p of [...existingProfiles, ...profiles]) {
    profileMap.set(p.device_id, p);
  }

  await localStore.seed(
    [...keptCheckins, ...checkins],
    Array.from(profileMap.values()),
    [...existingFriendships, ...friendships],
  );

  return {
    friendCodes: friends.map((t) => friendCodeFromDeviceId(t.id)),
    count: checkins.length,
  };
}
