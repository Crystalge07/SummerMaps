export const PATH_COLORS = [
  "#7A9474", // sage
  "#D89B8C", // blush
  "#A9C4C8", // sky
  "#E8C98A", // butter
  "#5C7458", // deep sage
  "#C4A484", // tan
  "#8FA8A3", // mist
  "#D4B5A0", // sand
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
