export type CheckIn = {
  id: string;
  device_id: string;
  prompt: string | null;
  lat: number;
  lng: number;
  photo_url: string;
  caption: string | null;
  created_at: string;
};

/** Public profile for friend codes — no accounts, just a shareable handle. */
export type DeviceProfile = {
  device_id: string;
  code: string;
  display_name: string | null;
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
};
