"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// Front desk for hotel hosts and the staff they add: today's arrivals, verify
// a guest's arrival pass, check them in, and record no-shows.

interface Arrival {
  booking_id: string; property_title: string; guest_name: string; guests: number; check_in: string; check_out: string;
  nights: number; eta: string | null; room: string | null; registered: boolean; lockbox_set: boolean;
  state: "awaiting" | "arrived" | "checked_in" | "no_show"; from_yesterday: boolean; no_show_allowed: boolean;
}
interface Board { today: string; arrivals: Arrival[]; walk_ins: { property_title: string; room: string; guest: string; until: string }[] }
interface Verified {
  booking_id: string; property_title: string; guest_name: string; guests: number; room: string | null; check_in: string; check_out: string;
  nights: number; paid: boolean; id_verified: boolean; valid_today: boolean; checked_in_at: string | null; no_show_at: string | null;
  card: { address: string; nationality: string; vehicle_plate: string | null; purpose: string | null; next_destination: string | null; signature: string; signed_at: string } | null;
}

const STATE_LABEL: Record<Arrival["state"], string> = { awaiting: "Expected", arrived: "Here — waiting", checked_in: "Checked in", no_show: "No-show" };

export default function ArrivalsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState<Verified | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_arrivals_board", { p_property_id: null });
    if (error) { setErr(error.message); return; }
    setBoard(data as Board);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading, session, router, load]);

  async function verify() {
    setErr(null); setMsg(null); setVerified(null);
    const { data, error } = await supabase.rpc("verify_arrival_pass", { p_code: code });
    if (error) { setErr(error.message); return; }
    setVerified(data as Verified);
  }

  async function act(fn: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await fn;
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(ok); setVerified(null); setCode("");
    load();
  }
  const checkIn = (id: string) => act(supabase.rpc("check_in_guest", { p_booking_id: id }), "Guest checked in.");
  const noShow = (id: string) => {
    if (!window.confirm("Record this guest as a no-show? The booking closes under the cancellation terms and the room is freed.")) return;
    act(supabase.rpc("mark_guest_no_show", { p_booking_id: id }), "No-show recorded. The room is open again.");
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/host" className="text-xs text-white/70">← Host dashboard</Link>
        <h1 className="font-serif text-lg font-bold mt-1">🛎️ Front Desk</h1>
        <p className="text-xs text-white/60 mt-1">Today&apos;s arrivals, pass verification and check-in.</p>
        <Link href="/host/work" className="inline-block mt-2 text-[11px] underline text-white/80">📋 Duties &amp; shift report →</Link>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-md mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-bold text-chs-charcoal mb-1">Verify a guest&apos;s arrival pass</p>
          <div className="flex gap-1.5">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono tracking-widest" />
            <button type="button" onClick={verify} disabled={code.trim().length < 8} className="px-4 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">Check</button>
          </div>
          {verified && (
            <div className="mt-2 bg-gray-50 rounded-lg p-2.5 text-[11px] text-chs-charcoal space-y-0.5">
              <p className="font-bold text-sm">{verified.guest_name} · {verified.guests} guest{verified.guests !== 1 ? "s" : ""}</p>
              <p>{verified.property_title}{verified.room ? ` · ${verified.room}` : ""}</p>
              <p>{verified.check_in} → {verified.check_out} ({verified.nights} night{verified.nights !== 1 ? "s" : ""})</p>
              <p className={verified.paid ? "text-green-700" : "text-chs-red"}>{verified.paid ? "✓ Paid, held safely by CHS" : "✗ Not paid"}</p>
              <p className={verified.id_verified ? "text-green-700" : "text-amber-700"}>{verified.id_verified ? "✓ Identity verified by CHS" : "Identity not fully verified. Please see their ID."}</p>
              {!verified.valid_today && !verified.checked_in_at && <p className="text-amber-700">This pass is not valid today.</p>}
              {verified.card ? (
                <div className="bg-white rounded p-2 mt-1 border border-gray-200">
                  <p className="font-semibold">Registration card</p>
                  <p>{verified.card.address} · {verified.card.nationality}</p>
                  {verified.card.vehicle_plate && <p>Vehicle: {verified.card.vehicle_plate}</p>}
                  {verified.card.purpose && <p>Purpose: {verified.card.purpose}</p>}
                  {verified.card.next_destination && <p>Next: {verified.card.next_destination}</p>}
                  <p className="italic text-gray-500">Signed: {verified.card.signature}</p>
                </div>
              ) : <p className="text-gray-500">No registration card yet. Have the guest fill one in.</p>}
              {verified.checked_in_at
                ? <p className="text-green-700 font-semibold">Already checked in.</p>
                : <button type="button" disabled={busy || !verified.valid_today || !verified.paid} onClick={() => checkIn(verified.booking_id)} className="w-full mt-1.5 py-2 rounded-full bg-green-600 text-white text-xs font-semibold disabled:opacity-50">✓ Check this guest in</button>}
            </div>
          )}
        </div>

        {msg && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{msg}</p>}
        {err && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{err}</p>}

        <p className="text-xs font-bold text-chs-charcoal">Arrivals{board ? ` (${board.arrivals.length})` : ""}</p>
        {!board ? <p className="text-xs text-gray-400">Loading…</p> : board.arrivals.length === 0 ? (
          <p className="text-xs text-gray-400">No arrivals expected. If you manage a hotel, make sure your bookings are paid and confirmed.</p>
        ) : board.arrivals.map((a) => (
          <div key={a.booking_id} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold text-chs-charcoal">{a.guest_name}</p>
                <p className="text-[10px] text-gray-500">{a.property_title}{a.room ? ` · ${a.room}` : ""} · {a.guests} guest{a.guests !== 1 ? "s" : ""} · {a.nights} night{a.nights !== 1 ? "s" : ""}</p>
                <p className="text-[10px] text-gray-500">{a.eta ? `Expected ${a.eta}` : "No arrival time given"}{a.from_yesterday ? " · was due yesterday" : ""}</p>
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${a.state === "arrived" ? "bg-amber-100 text-amber-800" : a.state === "checked_in" ? "bg-green-100 text-green-800" : a.state === "no_show" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{STATE_LABEL[a.state]}</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">{a.registered ? "✓ Registration card done" : "No registration card yet"}{a.lockbox_set ? " · self check-in code set" : ""}</p>
            {(a.state === "awaiting" || a.state === "arrived") && (
              <div className="flex gap-1.5 mt-2">
                <button type="button" disabled={busy} onClick={() => checkIn(a.booking_id)} className="flex-1 py-2 rounded-full bg-green-600 text-white text-[11px] font-semibold disabled:opacity-50">Check in</button>
                {a.no_show_allowed && <button type="button" disabled={busy} onClick={() => noShow(a.booking_id)} className="px-3 py-2 rounded-full border border-red-300 text-red-700 text-[11px] font-semibold disabled:opacity-50">No-show</button>}
              </div>
            )}
          </div>
        ))}

        {board && board.walk_ins.length > 0 && (
          <>
            <p className="text-xs font-bold text-chs-charcoal mt-2">Walk-ins in house</p>
            {board.walk_ins.map((w, i) => (
              <p key={i} className="text-[11px] text-gray-600 bg-white rounded-lg border border-gray-200 px-3 py-2">{w.guest} · {w.property_title} · {w.room} · until {w.until}</p>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
