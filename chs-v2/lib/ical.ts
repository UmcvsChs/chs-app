// Small, dependency-free iCalendar (.ics) reader. It only reads what availability needs: each event's UID,
// first day and end day (the day after the last night). Cancelled events are ignored.
export interface IcalEvent { uid: string; start: string; end: string }

function toDate(v: string): string | null {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function addDay(d: string): string {
  const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

export function parseIcal(text: string): IcalEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const out: IcalEvent[] = [];
  let cur: { uid?: string; start?: string; end?: string; cancelled?: boolean } | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") {
      if (cur && cur.uid && cur.start && !cur.cancelled) {
        let end = cur.end || addDay(cur.start);
        if (end <= cur.start) end = addDay(cur.start);
        out.push({ uid: cur.uid, start: cur.start, end });
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).split(";")[0].toUpperCase();
    const val = line.slice(idx + 1).trim();
    if (key === "UID") cur.uid = val;
    else if (key === "DTSTART") cur.start = toDate(val) || undefined;
    else if (key === "DTEND") cur.end = toDate(val) || undefined;
    else if (key === "STATUS" && val.toUpperCase() === "CANCELLED") cur.cancelled = true;
  }
  return out;
}
