// The floor a room is on: the host's own setting, otherwise worked out from the room number (203 is floor 2, 1204 is floor 12).
export function unitFloor(label: string, floor: number | null | undefined): number | null {
  if (floor !== null && floor !== undefined) return floor;
  if (/^\d{3}$/.test(label)) return parseInt(label.slice(0, 1), 10);
  if (/^\d{4}$/.test(label)) return parseInt(label.slice(0, 2), 10);
  return null;
}
export function floorName(f: number | null): string {
  if (f === null) return "Floor not stated";
  if (f === 0) return "Ground floor";
  if (f < 0) return `Basement ${Math.abs(f)}`;
  return `Floor ${f}`;
}
export const ROOM_FEATURES: { key: string; label: string }[] = [
  { key: "connecting", label: "🔗 Connecting door" },
  { key: "accessible", label: "♿ Easy access" },
  { key: "balcony", label: "🌇 Balcony" },
  { key: "view", label: "🏞️ View" },
  { key: "quiet", label: "🤫 Quiet side" },
];
export function featureLabel(k: string): string { return ROOM_FEATURES.find((f) => f.key === k)?.label || k; }
