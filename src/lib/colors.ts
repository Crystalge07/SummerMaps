export const PATH_COLORS = [
  "#E85D4C", // coral
  "#1F8A70", // teal
  "#F4A261", // amber
  "#3D5A80", // ink blue
  "#9B5DE5", // violet (accent only)
  "#2A9D8F", // sea
  "#E76F51", // burnt orange
  "#457B9D", // steel
] as const;

export function colorForDevice(deviceId: string, index = 0): string {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i++) {
    hash = (hash * 31 + deviceId.charCodeAt(i)) >>> 0;
  }
  return PATH_COLORS[(hash + index) % PATH_COLORS.length];
}

export function shortLabel(deviceId: string): string {
  return `Traveler ${deviceId.slice(0, 4).toUpperCase()}`;
}
