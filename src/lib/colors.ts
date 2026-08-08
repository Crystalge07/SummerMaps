export const PATH_COLORS = [
  "#E56B3A", // poppy
  "#3F7A4C", // leaf
  "#D4A017", // butter gold
  "#5A8FB0", // sky
  "#C45C6A", // rose
  "#6B8F71", // sage
  "#C97B3A", // apricot
  "#3D5C6E", // lake
] as const;

export function colorForDevice(deviceId: string, index = 0): string {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i++) {
    hash = (hash * 31 + deviceId.charCodeAt(i)) >>> 0;
  }
  return PATH_COLORS[(hash + index) % PATH_COLORS.length];
}

export function shortLabel(deviceId: string): string {
  return `Friend ${deviceId.slice(0, 4).toUpperCase()}`;
}
