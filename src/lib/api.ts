import { colorForDevice, shortLabel } from "./colors";
import { friendCodeFromDeviceId } from "./friendCode";
import { localStore } from "./localStore";
import {
  getSupabase,
  getSupabaseStorage,
  isSupabaseConfigured,
} from "./supabase";
import type {
  CheckIn,
  CreateCheckInInput,
  DeviceProfile,
  Friendship,
  PathSeries,
  Profile,
} from "./types";
import { isUsernameTakenError, normalizeUsername } from "./username";

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export async function uploadCheckInPhoto(
  file: Blob,
  deviceId: string,
): Promise<string> {
  // Always device-scoped path — works for anonymous + logged-in users.
  const safeDevice = (deviceId || "anon").replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `${safeDevice}/${Date.now()}.jpg`;

  // Use anon storage client so a logged-in session JWT cannot block public uploads.
  const supabase = getSupabaseStorage() ?? getSupabase();
  if (!supabase) return localStore.uploadPhoto(file, filename);

  const { error } = await supabase.storage
    .from("checkins")
    .upload(filename, file, { contentType: "image/jpeg", upsert: false });
  if (error) {
    const msg = error.message || String(error);
    if (/bucket not found/i.test(msg)) {
      throw new Error(
        'Storage bucket "checkins" was not found in this Supabase project. ' +
          "Create a public bucket named exactly checkins (Storage → New bucket), " +
          "or re-run the storage section of supabase/schema.sql on this project.",
      );
    }
    throw error;
  }

  const { data } = supabase.storage.from("checkins").getPublicUrl(filename);
  return data.publicUrl;
}

export async function createCheckIn(
  input: CreateCheckInInput,
): Promise<CheckIn> {
  const supabase = getSupabase();
  if (!supabase) return localStore.createCheckIn(input);

  await ensureDeviceProfile(input.device_id);

  const { data, error } = await supabase
    .from("checkins")
    .insert({
      device_id: input.device_id,
      prompt: input.prompt ?? null,
      lat: input.lat,
      lng: input.lng,
      photo_url: input.photo_url,
      caption: input.caption ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CheckIn;
}

/** Extract storage object path from a public URL or local `#path` data URL. */
export function storagePathFromPhotoUrl(photoUrl: string): string | null {
  if (!photoUrl) return null;
  const hashIdx = photoUrl.indexOf("#");
  if (photoUrl.startsWith("data:") && hashIdx >= 0) {
    return photoUrl.slice(hashIdx + 1) || null;
  }
  const marker = "/object/public/checkins/";
  const idx = photoUrl.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(photoUrl.slice(idx + marker.length).split("?")[0]);
  }
  const match = photoUrl.match(/\/checkins\/(.+?)(?:\?|$)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Delete own check-in. Requires matching device_id (ownership check).
 * Also removes the photo from the checkins storage bucket when possible.
 */
export async function deleteCheckIn(
  checkInId: string,
  deviceId: string,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return localStore.deleteCheckIn(checkInId, deviceId);

  const { data: row, error: fetchError } = await supabase
    .from("checkins")
    .select("id, device_id, photo_url")
    .eq("id", checkInId)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!row) throw new Error("Check-in not found or not yours.");

  const { error: deleteError } = await supabase
    .from("checkins")
    .delete()
    .eq("id", checkInId)
    .eq("device_id", deviceId);
  if (deleteError) throw deleteError;

  const path = storagePathFromPhotoUrl(row.photo_url);
  if (path && !path.startsWith("data:")) {
    const storage = getSupabaseStorage() ?? supabase;
    await storage.storage.from("checkins").remove([path]);
  }
}

export async function getTodayCheckinsForDevice(
  deviceId: string,
): Promise<CheckIn[]> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getTodayByDevice(deviceId);

  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("device_id", deviceId)
    .gte("created_at", startOfTodayISO())
    .lte("created_at", endOfTodayISO())
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CheckIn[];
}

export async function getTodayCheckinsForDevices(
  deviceIds: string[],
): Promise<CheckIn[]> {
  if (deviceIds.length === 0) return [];
  const supabase = getSupabase();
  if (!supabase) return localStore.getTodayByDevices(deviceIds);

  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .in("device_id", deviceIds)
    .gte("created_at", startOfTodayISO())
    .lte("created_at", endOfTodayISO())
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CheckIn[];
}

export async function getTodayCityCheckins(): Promise<CheckIn[]> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getTodayCity();

  const { data, error } = await supabase
    .from("checkins")
    .select("id, lat, lng, photo_url, caption, created_at, device_id, prompt")
    .gte("created_at", startOfTodayISO())
    .lte("created_at", endOfTodayISO())
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CheckIn[];
}

export async function getAllCheckins(): Promise<CheckIn[]> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getAllCheckins();

  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CheckIn[];
}

/** All finds for one device (personal mosaics / memories). */
export async function getCheckinsForDevice(
  deviceId: string,
): Promise<CheckIn[]> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getByDevice(deviceId);

  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CheckIn[];
}

export async function getProfileByDevice(
  deviceId: string,
): Promise<DeviceProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getProfileByDevice(deviceId);

  const { data, error } = await supabase
    .from("device_profiles")
    .select("*")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error) throw error;
  return (data as DeviceProfile) ?? null;
}

/** Alias used by friends UI — same as getProfileByDevice. */
export async function getProfileByDeviceId(
  deviceId: string,
): Promise<DeviceProfile | null> {
  return getProfileByDevice(deviceId);
}

export async function ensureDeviceProfile(
  deviceId: string,
  displayName?: string | null,
): Promise<DeviceProfile> {
  const supabase = getSupabase();
  if (!supabase) return localStore.ensureProfile(deviceId);

  const existing = await getProfileByDevice(deviceId);
  if (existing && displayName === undefined) return existing;

  const code = friendCodeFromDeviceId(deviceId);
  const { data, error } = await supabase
    .from("device_profiles")
    .upsert(
      {
        device_id: deviceId,
        code,
        display_name:
          displayName !== undefined
            ? displayName
            : (existing?.display_name ?? null),
      },
      { onConflict: "device_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as DeviceProfile;
}

export async function getProfileByCode(
  code: string,
): Promise<DeviceProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getProfileByCode(code);

  const { data, error } = await supabase
    .from("device_profiles")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as DeviceProfile) ?? null;
}

export async function getMyProfile(deviceId: string): Promise<DeviceProfile> {
  return ensureDeviceProfile(deviceId);
}

export async function addFriend(
  myDeviceId: string,
  friendCode: string,
): Promise<Friendship> {
  const profile = await getProfileByCode(friendCode);
  if (!profile) throw new Error("No one found with that friend code.");
  if (profile.device_id === myDeviceId) {
    throw new Error("You can't friend yourself.");
  }

  const already = await getFriendDeviceIds(myDeviceId);
  if (already.includes(profile.device_id)) {
    throw new Error("You're already connected.");
  }

  const supabase = getSupabase();
  if (!supabase) return localStore.addFriendship(myDeviceId, profile.device_id);

  await ensureDeviceProfile(myDeviceId);

  const [a, b] =
    myDeviceId < profile.device_id
      ? [myDeviceId, profile.device_id]
      : [profile.device_id, myDeviceId];

  const { data, error } = await supabase
    .from("friendships")
    .upsert(
      { a_device_id: a, b_device_id: b },
      { onConflict: "a_device_id,b_device_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as Friendship;
}

export async function getFriendDeviceIds(deviceId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getFriendDeviceIds(deviceId);

  const { data, error } = await supabase
    .from("friendships")
    .select("a_device_id, b_device_id")
    .or(`a_device_id.eq.${deviceId},b_device_id.eq.${deviceId}`);
  if (error) throw error;

  return (data ?? []).map((f) =>
    f.a_device_id === deviceId ? f.b_device_id : f.a_device_id,
  );
}

/** Connect check-ins into paths (for self + friends). */
export function groupCheckinsIntoPaths(
  checkins: CheckIn[],
  labels?: Map<string, string>,
): PathSeries[] {
  const byDevice = new Map<string, CheckIn[]>();
  for (const c of checkins) {
    const list = byDevice.get(c.device_id) ?? [];
    list.push(c);
    byDevice.set(c.device_id, list);
  }

  let i = 0;
  return Array.from(byDevice.entries()).map(([deviceId, rows]) => {
    const color = colorForDevice(deviceId, i++);
    return {
      deviceId,
      color,
      label: labels?.get(deviceId) ?? shortLabel(deviceId),
      checkins: rows.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      connect: true,
    };
  });
}

/**
 * City / stranger view: each find is its own pin.
 * Never connect pins by device — strangers can't tell who posted what.
 */
export function checkinsAsUnlinkedPins(checkins: CheckIn[]): PathSeries[] {
  return checkins.map((c, idx) => ({
    deviceId: `pin-${c.id}`,
    color: colorForDevice(c.id, idx),
    label: `Find ${idx + 1}`,
    checkins: [
      {
        ...c,
        device_id: "anon",
      },
    ],
    connect: false,
  }));
}

export function storageMode(): "supabase" | "local" {
  return isSupabaseConfigured ? "supabase" : "local";
}

export async function getAuthProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

export async function claimUsername(username: string): Promise<Profile> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const normalized = normalizeUsername(username);
  const { data, error } = await supabase.rpc("claim_username", {
    new_username: normalized,
  });
  if (error) {
    if (isUsernameTakenError(error)) {
      throw new Error("username_taken");
    }
    const msg = error.message ?? "";
    if (msg.includes("username_invalid")) {
      throw new Error("username_invalid");
    }
    throw error;
  }

  const profile = data as Profile;
  // Keep friend-code table in sync so existing friendship flows keep working.
  await ensureDeviceProfile(profile.id, profile.username);
  return profile;
}

/** Availability hint only — unique index / claim_username is the source of truth. */
export async function checkUsernameAvailable(
  username: string,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;

  const normalized = normalizeUsername(username);
  if (!normalized) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", normalized)
    .maybeSingle();
  if (error) throw error;
  return data == null;
}

export async function searchProfiles(
  query: string,
  limit = 10,
): Promise<Profile[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const q = normalizeUsername(query);
  if (!q) return [];

  const { data, error } = await supabase.rpc("search_profiles", {
    query: q,
    lim: limit,
  });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function getProfileByUsername(
  username: string,
): Promise<Profile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", normalizeUsername(username))
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

/** Add a friend by their public username (auth-backed profiles). */
export async function addFriendByUsername(
  myUserId: string,
  username: string,
): Promise<Friendship> {
  const profile = await getProfileByUsername(username);
  if (!profile) throw new Error("No one found with that username.");
  if (profile.id === myUserId) {
    throw new Error("You can't friend yourself.");
  }

  const already = await getFriendDeviceIds(myUserId);
  if (already.includes(profile.id)) {
    throw new Error("You're already connected.");
  }

  // Friendships still key off device_id columns — synced to auth.uid().
  const friendDevice = await ensureDeviceProfile(profile.id, profile.username);
  return addFriend(myUserId, friendDevice.code);
}

