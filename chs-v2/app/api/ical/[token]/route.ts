// Public availability feed for one room, read by Booking.com, Airbnb, Google Calendar and similar. The long
// random token in the link is the only key. The feed shows dates as "Booked" and never any guest detail.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/i, "");
  if (!/^[a-f0-9]{20,64}$/.test(clean)) return new Response("Not found", { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const r = await fetch(`${url}/rest/v1/rpc/ical_feed`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: clean }),
    cache: "no-store",
  });
  if (!r.ok) return new Response("Unavailable", { status: 502 });
  const body = (await r.json()) as string | null;
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}
