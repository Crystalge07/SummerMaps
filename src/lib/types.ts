export type CheckIn = {
  id: string;
  device_id: string;
  group_id: string | null;
  lat: number;
  lng: number;
  photo_url: string;
  caption: string | null;
  created_at: string;
};

export type Group = {
  id: string;
  code: string;
  name: string;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  device_id: string;
  display_color: string | null;
  joined_at: string;
};

export type PathSeries = {
  deviceId: string;
  color: string;
  label: string;
  checkins: CheckIn[];
};

export type CreateCheckInInput = {
  device_id: string;
  group_id?: string | null;
  lat: number;
  lng: number;
  photo_url: string;
  caption?: string | null;
};
