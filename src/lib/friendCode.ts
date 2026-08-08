/** Short share code derived from device id (stable, uppercase). */
export function friendCodeFromDeviceId(deviceId: string): string {
  return deviceId.replace(/-/g, "").slice(0, 6).toUpperCase();
}
