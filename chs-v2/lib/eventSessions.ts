// Event-centre bookings are made of SESSIONS: a date with a start and an end time. These helpers are shared by the
// guest form, the host settings panel and the booking cards. All prices and rules come from the server.

export interface Sess { date: string; start: string; end: string; label: string }

export interface Rules {
  allow_hourly: boolean;
  min_hours: number;
  open: string;
  close: string;
  setup_min: number;
  cleanup_min: number;
  full_day_hours: number;
  max_sessions: number;
}

export interface QSession {
  date: string | null;
  start: string | null;
  end: string | null;
  mins: number;
  fee: number;
  label: string | null;
  reason: string | null;
}

export interface EventQuote {
  ok: boolean;
  sessions: QSession[];
  sessions_total: number;
  minutes: number;
  days: number;
  facilities_total: number;
  base_amount: number;
  guest_commission: number;
  total_to_pay: number;
  tier_price: number;
  rate_per_hour: number;
  allow_hourly: boolean;
  setup_min: number;
  cleanup_min: number;
}

export interface BookedSession { id: string; date: string; start: string; end: string; label: string | null; fee: number; state: string }

// "16:00" -> "4 pm", "10:30" -> "10:30 am", "24:00" -> "midnight"
export function fmtTime(t: string | null | undefined): string {
  if (!t) return "";
  const [hs, ms] = t.split(":");
  const h = parseInt(hs, 10);
  const m = parseInt(ms || "0", 10);
  if (h >= 24) return "midnight";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "am" : "pm"}`;
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso + "T12:00:00+01:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}

export function fmtHours(mins: number): string {
  const h = mins / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hr${h === 1 ? "" : "s"}`;
}

export function toMin(t: string): number {
  const [h, m] = t.split(":");
  return parseInt(h, 10) * 60 + parseInt(m || "0", 10);
}

export function fromMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// half-hour choices between opening and closing
export function timeOptions(open: string, close: string, kind: "start" | "end", after?: string): string[] {
  const o = toMin(open);
  const c = toMin(close);
  const out: string[] = [];
  const from = kind === "start" ? o : Math.max(o + 30, after ? toMin(after) + 30 : o + 30);
  const to = kind === "start" ? c - 30 : c;
  for (let m = from; m <= to; m += 30) out.push(fromMin(m));
  return out;
}
