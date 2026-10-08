"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// The guest's digital check-in: an arrival code to show at the front desk, a
// short registration card filled in ahead of time, an "I've arrived" button
// (with an optional nearness check) and, if the host set one, the self
// check-in code revealed only once the guest says they have arrived.

interface Pass {
  code: string; property_title: string; check_in: string; check_out: string; nights: number;
  room: string | null; id_verified: boolean; registered: boolean; arrived_at: string | null;
  checked_in_at: string | null; lockbox_set: boolean; arrival_day: boolean; location_set: boolean;
}

export default function GuestArrivalPass({ bookingId }: { bookingId: string }) {
  const [pass, setPass] = useState<Pass | null>(null);
  const [hidden, setHidden] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [lockbox, setLockbox] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ address: "", nationality: "", vehicle_plate: "", purpose: "", next_destination: "", eta: "", signature: "" });

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_arrival_pass", { p_booking_id: bookingId });
    if (error || !data) { setHidden(true); return; }
    setPass(data as Pass);
  }, [bookingId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function revealLockbox() {
    const { data } = await supabase.rpc("get_my_lockbox_code", { p_booking_id: bookingId });
    const r = data as { available: boolean; code?: string; message?: string } | null;
    if (r?.available && r.code) setLockbox(r.code); else if (r?.message) setMsg(r.message);
  }

  async function saveCard() {
    setErr(null); setBusy(true);
    const { error } = await supabase.rpc("submit_registration_card", {
      p_booking_id: bookingId, p_address: f.address.trim(), p_nationality: f.nationality.trim(),
      p_vehicle_plate: f.vehicle_plate.trim() || null, p_purpose: f.purpose.trim() || null,
      p_next_destination: f.next_destination.trim() || null, p_eta: f.eta.trim() || null, p_signature: f.signature.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setShowCard(false); setMsg("Registration card saved. The front desk will have it ready."); load();
  }

  function announce() {
    setErr(null); setMsg(null); setBusy(true);
    const send = async (lat: number | null, lng: number | null) => {
      const { error } = await supabase.rpc("guest_arrived", { p_booking_id: bookingId, p_lat: lat, p_lng: lng });
      setBusy(false);
      if (error) { setErr(error.message); return; }
      setMsg("The front desk has been told you are here.");
      await load();
      if (pass?.lockbox_set) revealLockbox();
    };
    if (pass?.location_set && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => send(p.coords.latitude, p.coords.longitude),
        () => send(null, null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else send(null, null);
  }

  if (hidden || !pass) return null;

  return (
    <div className="mt-2 border border-green-200 bg-green-50/50 rounded-lg p-3">
      <p className="text-xs font-bold text-chs-charcoal">🎫 Your arrival pass</p>
      <p className="font-mono text-2xl font-bold tracking-widest text-chs-charcoal text-center my-1.5 select-all">{pass.code}</p>
      <p className="text-[10px] text-gray-600 text-center">Show this code at the front desk. {pass.room ? `Your room: ${pass.room}.` : ""} {pass.id_verified ? "✓ Your identity is verified by CHS." : ""}</p>

      {pass.checked_in_at ? (
        <p className="text-[11px] text-green-700 font-semibold text-center mt-2">✓ Checked in</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {!pass.registered ? (
            <button type="button" onClick={() => setShowCard((s) => !s)} className="w-full py-2 rounded-full border border-chs-charcoal text-chs-charcoal text-[11px] font-semibold">
              📝 Fill in your registration card now (saves time at the desk)
            </button>
          ) : <p className="text-[10px] text-green-700 text-center">✓ Registration card done</p>}

          {showCard && (
            <div className="bg-white rounded-lg border border-gray-200 p-2.5 space-y-1.5">
              <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Home address *" className="w-full px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
              <input value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} placeholder="Nationality *" className="w-full px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
              <input value={f.vehicle_plate} onChange={(e) => setF({ ...f, vehicle_plate: e.target.value })} placeholder="Vehicle plate (optional)" className="w-full px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
              <input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="Purpose of stay (optional)" className="w-full px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
              <input value={f.next_destination} onChange={(e) => setF({ ...f, next_destination: e.target.value })} placeholder="Next destination (optional)" className="w-full px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
              <input value={f.eta} onChange={(e) => setF({ ...f, eta: e.target.value })} placeholder="Expected arrival time (optional)" className="w-full px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
              <input value={f.signature} onChange={(e) => setF({ ...f, signature: e.target.value })} placeholder="Type your full name as your signature *" className="w-full px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
              <button type="button" disabled={busy || !f.address.trim() || !f.nationality.trim() || !f.signature.trim()} onClick={saveCard} className="w-full py-2 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">Save registration card</button>
            </div>
          )}

          {pass.arrival_day && !pass.arrived_at && (
            <button type="button" disabled={busy} onClick={announce} className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
              🚪 I&apos;ve arrived
            </button>
          )}
          {pass.arrived_at && <p className="text-[11px] text-green-700 text-center">✓ The front desk knows you are here.</p>}
          {pass.arrived_at && pass.lockbox_set && !lockbox && (
            <button type="button" onClick={revealLockbox} className="w-full py-2 rounded-full border border-chs-charcoal text-chs-charcoal text-[11px] font-semibold">🔑 Show my self check-in code</button>
          )}
          {lockbox && <p className="text-center text-sm font-mono font-bold bg-white rounded-lg py-2 border border-gray-200">🔑 {lockbox}</p>}
          {!pass.arrival_day && <p className="text-[10px] text-gray-500 text-center">“I&apos;ve arrived” is available from {pass.check_in}.</p>}
        </div>
      )}
      {msg && <p className="text-[10px] text-green-700 mt-1.5 text-center">{msg}</p>}
      {err && <p className="text-[10px] text-chs-red mt-1.5 text-center">{err}</p>}
    </div>
  );
}
