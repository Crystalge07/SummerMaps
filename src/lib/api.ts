import { colorForDevice, shortLabel } from "./colors";
import { localStore } from "./localStore";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type {
  CheckIn,
  CreateCheckInInput,
  Group,
  GroupMember,
  PathSeries,
} from "./types";

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
  const filename = `${deviceId}/${Date.now()}.jpg`;
  const supabase = getSupabase();
  if (!supabase) return localStore.uploadPhoto(file, filename);

  const { error } = await supabase.storage
    .from("checkins")
    .upload(filename, file, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("checkins").getPublicUrl(filename);
  return data.publicUrl;
}

export async function createCheckIn(
  input: CreateCheckInInput,
): Promise<CheckIn> {
  const supabase = getSupabase();
  if (!supabase) return localStore.createCheckIn(input);

  const { data, error } = await supabase
    .from("checkins")
    .insert({
      device_id: input.device_id,
      group_id: input.group_id ?? null,
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

export async function getTodayCheckinsForGroup(
  groupId: string,
): Promise<CheckIn[]> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getTodayByGroup(groupId);

  const { data: members, error: memberError } = await supabase
    .from("group_members")
    .select("device_id")
    .eq("group_id", groupId);
  if (memberError) throw memberError;

  const deviceIds = (members ?? []).map((m) => m.device_id as string);
  if (deviceIds.length === 0) return [];

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
    .select("id, lat, lng, photo_url, caption, created_at, device_id, group_id")
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

export async function createGroup(name: string): Promise<Group> {
  const supabase = getSupabase();
  if (!supabase) return localStore.createGroup(name);

  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, code })
    .select()
    .single();
  if (error) throw error;
  return data as Group;
}

export async function getGroupByCode(code: string): Promise<Group | null> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getGroupByCode(code);

  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as Group) ?? null;
}

export async function getGroupById(id: string): Promise<Group | null> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getGroupById(id);

  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Group) ?? null;
}

export async function joinGroup(
  groupId: string,
  deviceId: string,
): Promise<GroupMember> {
  const supabase = getSupabase();
  if (!supabase) return localStore.joinGroup(groupId, deviceId);

  const { data, error } = await supabase
    .from("group_members")
    .upsert(
      {
        group_id: groupId,
        device_id: deviceId,
        display_color: colorForDevice(deviceId),
      },
      { onConflict: "group_id,device_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as GroupMember;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const supabase = getSupabase();
  if (!supabase) return localStore.getMembers(groupId);

  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export function groupCheckinsIntoPaths(
  checkins: CheckIn[],
  members?: GroupMember[],
  anonymize = false,
): PathSeries[] {
  const byDevice = new Map<string, CheckIn[]>();
  for (const c of checkins) {
    const list = byDevice.get(c.device_id) ?? [];
    list.push(c);
    byDevice.set(c.device_id, list);
  }

  const colorMap = new Map(
    (members ?? []).map((m) => [
      m.device_id,
      m.display_color ?? colorForDevice(m.device_id),
    ]),
  );

  let i = 0;
  return Array.from(byDevice.entries()).map(([deviceId, rows]) => {
    const color = colorMap.get(deviceId) ?? colorForDevice(deviceId, i++);
    return {
      deviceId,
      color,
      label: anonymize ? `Path ${i}` : shortLabel(deviceId),
      checkins: rows.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    };
  });
}

export function storageMode(): "supabase" | "local" {
  return isSupabaseConfigured ? "supabase" : "local";
}
