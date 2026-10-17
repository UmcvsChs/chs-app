"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { catInfo, PAY_NOTICE } from "@/components/ServiceCategories";

// Guest side, inside My bookings: reserve the hotel's in-house services for the stay, before or during it.
// Reserving is free and carries no payment; the guest pays the hotel directly.

interface Svc { id: string; category: string; name: string; price_from: number | null; price_note: string | null; capacity: string | null; hours: string | null; bookable: boolean }
interface Mine { id: string; service: string; status: string; quantity: number; preferred_date: string | null; preferred_time: string | null; note: string | null; host_note: string | null }
const LABEL: Record<string, string> = { requested: "Waiting for the hotel", accepted: "✓ Reserved by the hotel", declined: "Not available", cancelled: "Withdrawn", done: "Done" };

export default function GuestServiceReservations({ bookingId, propertyId, checkIn, checkOut }: { bookingId: string; propertyId: string; checkIn: string; checkOut: string }) {
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [open, setOpen] = useState(false);
  const [sid, setSid] = useState(""); const [qty, setQty] = useState(1); const [date, setDate] = useState(""); const [time, setTime] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const a = await supabase.rpc("get_offered_services", { p_property_id: propertyId });
    setSvcs(((a.data as Svc[]) ?? []));
    const m = await supabase.rpc("get_my_service_requests", { p_booking_id: bookingId });
    setMine(((m.data as Mine[]) ?? []));
  }, [propertyId, bookingId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (svcs.length === 0) return null;
  const bookable = svcs.filter((s) => s.bookable);

  async function reserve(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("request_hotel_service", { p_booking_id: bookingId, p_service_id: sid, p_quantity: qty, p_date: date || null, p_time: time || null, p_note: note || null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("Reserved. The hotel will confirm. Nothing is charged by CHS; you pay the hotel directly."); setNote(""); setTime(""); load();
  }
  async function withdraw(id: string) {
    const { error } = await supabase.rpc("cancel_service_request", { p_id: id });
    if (error) setErr(error.message); else load();
  }

  return (
    <div className="mt-3 border border-gray-200 rounded-xl p-3">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center text-sm font-semibold">
        <span>🛎️ Hotel services for your stay ({svcs.length})</span><span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-3 text-xs">
          <p className="text-gray-500">{PAY_NOTICE}</p>
          <ul className="space-y-1">
            {svcs.map((s) => (
              <li key={s.id}><span className="font-semibold">{catInfo(s.category).icon} {s.name}</span>
                <span className="text-gray-600"> {s.price_from ? `· from ${formatNaira(s.price_from)}${s.price_note ? " " + s.price_note : ""}` : "· available"}{s.capacity ? ` · ${s.capacity}` : ""}{s.hours ? ` · ${s.hours}` : ""}{!s.bookable ? " · ask at the hotel" : ""}</span></li>
            ))}
          </ul>
          {bookable.length > 0 && (
            <form onSubmit={reserve} className="space-y-2 border-t border-gray-100 pt-2">
              <p className="font-semibold">Reserve a service</p>
              <select value={sid} onChange={(e) => setSid(e.target.value)} required className="w-full border border-gray-300 rounded px-2 py-1.5">
                <option value="">Choose a service…</option>
                {bookable.map((s) => <option key={s.id} value={s.id}>{catInfo(s.category).icon} {s.name}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" min={1} max={50} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} className="border border-gray-300 rounded px-2 py-1.5" aria-label="How many" />
                <input type="date" min={checkIn} max={checkOut} value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 col-span-2" aria-label="Which day" />
              </div>
              <input value={time} onChange={(e) => setTime(e.target.value)} maxLength={40} placeholder="Time, e.g. 7am (optional)" className="w-full border border-gray-300 rounded px-2 py-1.5" />
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Anything the hotel should know (optional)" className="w-full border border-gray-300 rounded px-2 py-1.5" />
              <button disabled={busy || !sid} className="px-4 py-1.5 rounded-full bg-chs-charcoal text-white font-semibold disabled:opacity-50">Reserve (no payment now)</button>
            </form>
          )}
          {msg && <p className="text-green-700">{msg}</p>}
          {err && <p className="text-red-600">{err}</p>}
          {mine.length > 0 && (
            <div className="border-t border-gray-100 pt-2 space-y-1">
              <p className="font-semibold">Your reservations</p>
              {mine.map((r) => (
                <div key={r.id} className="flex justify-between gap-2">
                  <span>{r.service} × {r.quantity}{r.preferred_date ? `, ${r.preferred_date}` : ""}{r.preferred_time ? ` ${r.preferred_time}` : ""}: <b>{LABEL[r.status] ?? r.status}</b>{r.host_note ? ` (“${r.host_note}”)` : ""}</span>
                  {["requested", "accepted"].includes(r.status) && <button onClick={() => withdraw(r.id)} className="text-red-600 font-semibold shrink-0">Withdraw</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
