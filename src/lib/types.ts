export type CheckIn = {
  id: string;
  device_id: string;
  prompt: string | null;
  lat: number;
  lng: number;
  photo_url: string;
  caption: string | null;
  /** Human-readable place from reverse geocode; null/absent if unknown. */
  location_name?: string | null;
  created_at: string;
};

/** Public profile for friend codes — shareable handle tied to a device/user id. */
export type DeviceProfile = {
  device_id: string;
  code: string;
  display_name: string | null;
  created_at: string;
};

/** Auth-backed profile — username is what others see and search for. */
export type Profile = {
  id: string;
  username: string;
  created_at: string;
};

export type Friendship = {
  id: string;
  a_device_id: string;
  b_device_id: string;
  created_at: string;
};

export type PathSeries = {
  deviceId: string;
  color: string;
  label: string;
  checkins: CheckIn[];
  /** When false, map shows pins only (stranger / city view). Default true. */
  connect?: boolean;
};

export type CreateCheckInInput = {
  device_id: string;
  prompt?: string | null;
  lat: number;
  lng: number;
  photo_url: string;
  caption?: string | null;
  location_name?: string | null;
};
