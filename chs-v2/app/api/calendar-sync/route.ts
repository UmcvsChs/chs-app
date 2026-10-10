import { parseIcal } from "@/lib/ical";

// Pulls one linked external calendar (an .ics link) for the signed-in owner or manager and records its booked
// dates as blocks on the CHS room calendar. Authorisation is the caller's own Supabase session: every database
// call below is made as that person, so the database decides whether they may do it.
const MAX_BYTES = 2_000_000;

async function rpc(name: string, token: string, args: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const text = await r.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: r.ok, data };
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { source_id?: string } | null;
  const id = body?.source_id;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Missing calendar." }, { status: 400 });

  const u = await rpc("get_calendar_source_for_sync", token, { p_source_id: id });
  if (!u.ok || typeof u.data !== "string") {
    const msg = (u.data as { message?: string })?.message || "Could not read that calendar link.";
    return Response.json({ error: msg }, { status: 403 });
  }
  const link = u.data;
  if (!/^https:\/\//i.test(link)) return Response.json({ error: "Only https links are allowed." }, { status: 400 });

  let failure: string | null = null;
  let events: unknown[] = [];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(link, { redirect: "manual", signal: ctrl.signal, headers: { Accept: "text/calendar, text/plain, */*" } });
    clearTimeout(timer);
    if (res.status >= 300 && res.status < 400) failure = "The link redirects somewhere else. Paste the final calendar link.";
    else if (!res.ok) failure = `The calendar site answered ${res.status}.`;
    else {
      const text = await res.text();
      if (text.length > MAX_BYTES) failure = "The calendar file is too large.";
      else if (!text.includes("BEGIN:VCALENDAR")) failure = "That link is not a calendar (.ics) file.";
      else events = parseIcal(text);
    }
  } catch {
    failure = "Could not reach that calendar link.";
  }

  const applied = await rpc("apply_external_events", token, { p_source_id: id, p_events: events, p_error: failure });
  if (!applied.ok) return Response.json({ error: (applied.data as { message?: string })?.message || "Could not save the calendar." }, { status: 400 });
  return Response.json(applied.data);
}
