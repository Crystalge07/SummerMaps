import type { CheckIn, CreateCheckInInput, Group, GroupMember } from "./types";
import { colorForDevice } from "./colors";

const CHECKINS_KEY = "pathline_checkins";
const GROUPS_KEY = "pathline_groups";
const MEMBERS_KEY = "pathline_members";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return crypto.randomUUID();
}

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isToday(iso: string) {
  const { start, end } = todayBounds();
  return iso >= start && iso <= end;
}

export const localStore = {
  async createCheckIn(input: CreateCheckInInput): Promise<CheckIn> {
    const checkins = read<CheckIn[]>(CHECKINS_KEY, []);
    const row: CheckIn = {
      id: uid(),
      device_id: input.device_id,
      group_id: input.group_id ?? null,
      lat: input.lat,
      lng: input.lng,
      photo_url: input.photo_url,
      caption: input.caption ?? null,
      created_at: new Date().toISOString(),
    };
    checkins.push(row);
    write(CHECKINS_KEY, checkins);
    return row;
  },

  async getTodayByDevice(deviceId: string): Promise<CheckIn[]> {
    return read<CheckIn[]>(CHECKINS_KEY, [])
      .filter((c) => c.device_id === deviceId && isToday(c.created_at))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async getTodayByGroup(groupId: string): Promise<CheckIn[]> {
    const members = read<GroupMember[]>(MEMBERS_KEY, []).filter(
      (m) => m.group_id === groupId,
    );
    const memberIds = new Set(members.map((m) => m.device_id));
    return read<CheckIn[]>(CHECKINS_KEY, [])
      .filter(
        (c) =>
          isToday(c.created_at) &&
          (c.group_id === groupId || memberIds.has(c.device_id)),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async getTodayCity(): Promise<CheckIn[]> {
    return read<CheckIn[]>(CHECKINS_KEY, [])
      .filter((c) => isToday(c.created_at))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async getAllCheckins(): Promise<CheckIn[]> {
    return read<CheckIn[]>(CHECKINS_KEY, []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
  },

  async createGroup(name: string): Promise<Group> {
    const groups = read<Group[]>(GROUPS_KEY, []);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const group: Group = {
      id: uid(),
      code,
      name,
      created_at: new Date().toISOString(),
    };
    groups.push(group);
    write(GROUPS_KEY, groups);
    return group;
  },

  async getGroupByCode(code: string): Promise<Group | null> {
    return (
      read<Group[]>(GROUPS_KEY, []).find(
        (g) => g.code.toUpperCase() === code.toUpperCase(),
      ) ?? null
    );
  },

  async getGroupById(id: string): Promise<Group | null> {
    return read<Group[]>(GROUPS_KEY, []).find((g) => g.id === id) ?? null;
  },

  async joinGroup(groupId: string, deviceId: string): Promise<GroupMember> {
    const members = read<GroupMember[]>(MEMBERS_KEY, []);
    const existing = members.find(
      (m) => m.group_id === groupId && m.device_id === deviceId,
    );
    if (existing) return existing;
    const member: GroupMember = {
      id: uid(),
      group_id: groupId,
      device_id: deviceId,
      display_color: colorForDevice(deviceId),
      joined_at: new Date().toISOString(),
    };
    members.push(member);
    write(MEMBERS_KEY, members);
    return member;
  },

  async getMembers(groupId: string): Promise<GroupMember[]> {
    return read<GroupMember[]>(MEMBERS_KEY, []).filter(
      (m) => m.group_id === groupId,
    );
  },

  async uploadPhoto(file: Blob, filename: string): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    // Keep filename in the URL fragment for debugging; payload is the data URL.
    return `${dataUrl}#${filename}`;
  },

  async listGroups(): Promise<Group[]> {
    return read<Group[]>(GROUPS_KEY, []);
  },

  async listMembers(): Promise<GroupMember[]> {
    return read<GroupMember[]>(MEMBERS_KEY, []);
  },

  async seed(checkins: CheckIn[], groups: Group[], members: GroupMember[]) {
    write(CHECKINS_KEY, checkins);
    write(GROUPS_KEY, groups);
    write(MEMBERS_KEY, members);
  },
};
