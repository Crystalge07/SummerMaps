import type {
  CheckIn,
  CreateCheckInInput,
  DeviceProfile,
  FriendRequest,
  Friendship,
} from "./types";
import { friendCodeFromDeviceId } from "./friendCode";
import { getTodaysPrompt } from "./prompts";

const CHECKINS_KEY = "pathline_checkins";
const PROFILES_KEY = "pathline_profiles";
const FRIENDSHIPS_KEY = "pathline_friendships";
const FRIEND_REQUESTS_KEY = "pathline_friend_requests";

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

function ensureProfile(deviceId: string): DeviceProfile {
  const profiles = read<DeviceProfile[]>(PROFILES_KEY, []);
  const existing = profiles.find((p) => p.device_id === deviceId);
  if (existing) return existing;
  const profile: DeviceProfile = {
    device_id: deviceId,
    code: friendCodeFromDeviceId(deviceId),
    display_name: null,
    created_at: new Date().toISOString(),
  };
  profiles.push(profile);
  write(PROFILES_KEY, profiles);
  return profile;
}

export const localStore = {
  async createCheckIn(input: CreateCheckInInput): Promise<CheckIn> {
    ensureProfile(input.device_id);
    const checkins = read<CheckIn[]>(CHECKINS_KEY, []);
    const row: CheckIn = {
      id: uid(),
      device_id: input.device_id,
      prompt: input.prompt ?? null,
      lat: input.lat,
      lng: input.lng,
      photo_url: input.photo_url,
      caption: input.caption ?? null,
      location_name: input.location_name?.trim() || null,
      created_at: new Date().toISOString(),
    };
    checkins.push(row);
    write(CHECKINS_KEY, checkins);
    return row;
  },

  async deleteCheckIn(checkInId: string, deviceId: string): Promise<void> {
    const checkins = read<CheckIn[]>(CHECKINS_KEY, []);
    const next = checkins.filter(
      (c) => !(c.id === checkInId && c.device_id === deviceId),
    );
    if (next.length === checkins.length) {
      throw new Error("Check-in not found or not yours.");
    }
    write(CHECKINS_KEY, next);
  },

  async getTodayByDevice(deviceId: string): Promise<CheckIn[]> {
    const prompt = getTodaysPrompt();
    return read<CheckIn[]>(CHECKINS_KEY, [])
      .filter(
        (c) =>
          c.device_id === deviceId &&
          isToday(c.created_at) &&
          (c.prompt ?? "").trim() === prompt,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async getTodayByDevices(deviceIds: string[]): Promise<CheckIn[]> {
    const set = new Set(deviceIds);
    const prompt = getTodaysPrompt();
    return read<CheckIn[]>(CHECKINS_KEY, [])
      .filter(
        (c) =>
          set.has(c.device_id) &&
          isToday(c.created_at) &&
          (c.prompt ?? "").trim() === prompt,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async getTodayCity(): Promise<CheckIn[]> {
    const prompt = getTodaysPrompt();
    return read<CheckIn[]>(CHECKINS_KEY, [])
      .filter(
        (c) =>
          isToday(c.created_at) && (c.prompt ?? "").trim() === prompt,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async getAllCheckins(): Promise<CheckIn[]> {
    return read<CheckIn[]>(CHECKINS_KEY, []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
  },

  async getByDevice(deviceId: string): Promise<CheckIn[]> {
    return read<CheckIn[]>(CHECKINS_KEY, [])
      .filter((c) => c.device_id === deviceId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async ensureProfile(deviceId: string): Promise<DeviceProfile> {
    return ensureProfile(deviceId);
  },

  async getProfileByCode(code: string): Promise<DeviceProfile | null> {
    const normalized = code.trim().toUpperCase();
    return (
      read<DeviceProfile[]>(PROFILES_KEY, []).find(
        (p) => p.code.toUpperCase() === normalized,
      ) ?? null
    );
  },

  async getProfileByDevice(deviceId: string): Promise<DeviceProfile | null> {
    return (
      read<DeviceProfile[]>(PROFILES_KEY, []).find(
        (p) => p.device_id === deviceId,
      ) ?? null
    );
  },

  async listProfiles(): Promise<DeviceProfile[]> {
    return read<DeviceProfile[]>(PROFILES_KEY, []);
  },

  async addFriendship(
    aDeviceId: string,
    bDeviceId: string,
  ): Promise<Friendship> {
    if (aDeviceId === bDeviceId) {
      throw new Error("You can't friend yourself.");
    }
    ensureProfile(aDeviceId);
    ensureProfile(bDeviceId);
    const friendships = read<Friendship[]>(FRIENDSHIPS_KEY, []);
    const existing = friendships.find(
      (f) =>
        (f.a_device_id === aDeviceId && f.b_device_id === bDeviceId) ||
        (f.a_device_id === bDeviceId && f.b_device_id === aDeviceId),
    );
    if (existing) return existing;
    const row: Friendship = {
      id: uid(),
      a_device_id: aDeviceId,
      b_device_id: bDeviceId,
      created_at: new Date().toISOString(),
    };
    friendships.push(row);
    write(FRIENDSHIPS_KEY, friendships);
    return row;
  },

  async getFriendDeviceIds(deviceId: string): Promise<string[]> {
    return read<Friendship[]>(FRIENDSHIPS_KEY, [])
      .filter(
        (f) => f.a_device_id === deviceId || f.b_device_id === deviceId,
      )
      .map((f) =>
        f.a_device_id === deviceId ? f.b_device_id : f.a_device_id,
      );
  },

  async removeFriendship(
    myDeviceId: string,
    friendDeviceId: string,
  ): Promise<void> {
    const friendships = read<Friendship[]>(FRIENDSHIPS_KEY, []);
    const next = friendships.filter(
      (f) =>
        !(
          (f.a_device_id === myDeviceId &&
            f.b_device_id === friendDeviceId) ||
          (f.a_device_id === friendDeviceId &&
            f.b_device_id === myDeviceId)
        ),
    );
    write(FRIENDSHIPS_KEY, next);
  },

  async listFriendships(): Promise<Friendship[]> {
    return read<Friendship[]>(FRIENDSHIPS_KEY, []);
  },

  async getFriendRequestBetween(
    fromDeviceId: string,
    toDeviceId: string,
  ): Promise<FriendRequest | null> {
    return (
      read<FriendRequest[]>(FRIEND_REQUESTS_KEY, []).find(
        (r) =>
          r.from_device_id === fromDeviceId && r.to_device_id === toDeviceId,
      ) ?? null
    );
  },

  async getIncomingFriendRequests(
    myDeviceId: string,
  ): Promise<FriendRequest[]> {
    return read<FriendRequest[]>(FRIEND_REQUESTS_KEY, [])
      .filter((r) => r.to_device_id === myDeviceId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async sendFriendRequest(
    fromDeviceId: string,
    toDeviceId: string,
  ): Promise<FriendRequest> {
    if (fromDeviceId === toDeviceId) {
      throw new Error("You can't friend yourself.");
    }
    ensureProfile(fromDeviceId);
    ensureProfile(toDeviceId);
    const requests = read<FriendRequest[]>(FRIEND_REQUESTS_KEY, []);
    const existing = requests.find(
      (r) =>
        r.from_device_id === fromDeviceId && r.to_device_id === toDeviceId,
    );
    if (existing) throw new Error("Request already sent.");
    const row: FriendRequest = {
      id: uid(),
      from_device_id: fromDeviceId,
      to_device_id: toDeviceId,
      created_at: new Date().toISOString(),
    };
    requests.push(row);
    write(FRIEND_REQUESTS_KEY, requests);
    return row;
  },

  async deleteFriendRequest(requestId: string): Promise<void> {
    const requests = read<FriendRequest[]>(FRIEND_REQUESTS_KEY, []);
    write(
      FRIEND_REQUESTS_KEY,
      requests.filter((r) => r.id !== requestId),
    );
  },

  async acceptFriendRequest(
    myDeviceId: string,
    requestId: string,
  ): Promise<void> {
    const requests = read<FriendRequest[]>(FRIEND_REQUESTS_KEY, []);
    const request = requests.find((r) => r.id === requestId);
    if (!request || request.to_device_id !== myDeviceId) {
      throw new Error("Friend request not found.");
    }
    await this.addFriendship(request.from_device_id, request.to_device_id);
    const next = requests.filter(
      (r) =>
        r.id !== requestId &&
        !(
          r.from_device_id === request.to_device_id &&
          r.to_device_id === request.from_device_id
        ),
    );
    write(FRIEND_REQUESTS_KEY, next);
  },

  async declineFriendRequest(
    myDeviceId: string,
    requestId: string,
  ): Promise<void> {
    const requests = read<FriendRequest[]>(FRIEND_REQUESTS_KEY, []);
    const request = requests.find((r) => r.id === requestId);
    if (!request || request.to_device_id !== myDeviceId) {
      throw new Error("Friend request not found.");
    }
    write(
      FRIEND_REQUESTS_KEY,
      requests.filter((r) => r.id !== requestId),
    );
  },

  async uploadPhoto(file: Blob, filename: string): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return `${dataUrl}#${filename}`;
  },

  async seed(
    checkins: CheckIn[],
    profiles: DeviceProfile[],
    friendships: Friendship[],
  ) {
    write(CHECKINS_KEY, checkins);
    write(PROFILES_KEY, profiles);
    write(FRIENDSHIPS_KEY, friendships);
  },
};
