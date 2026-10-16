"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// The master switch for "every payment needs the buyer's 6-digit transaction PIN". Turn it on only after the new
// version of the app is live for everyone: a user on an older version of the screens cannot type the PIN.
export default function AdminPaymentPinSwitch() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("payment_pin_status");
    setOn(!!(data as { required?: boolean } | null)?.required);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function set(next: boolean) {
    if (!window.confirm(next ? "Require every user's transaction PIN for every payment?" : "Stop asking for the PIN on payments?")) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("admin_set_payment_pin_required", { p_on: next });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(next ? "On. Users are now asked for their 6-digit PIN on every payment (users without a PIN create one at their first payment)." : "Off. Payments ask only for the amount confirmation.");
    load();
  }

  return (
    <div className={`rounded-xl border-2 p-3 mb-3 ${on ? "bg-green-50 border-green-300" : "bg-chs-amber-light border-chs-amber"}`}>
      <p className="text-xs font-bold text-chs-charcoal">🔐 Payment PIN: {on === null ? "…" : on ? "ON" : "OFF"}</p>
      <p className="text-[11px] text-gray-600 mt-0.5">When ON, nobody can pay from their wallet (bookings, marketplace, rent, inspections, property, services) without typing their 6-digit transaction PIN. The server enforces it, not just the screen. Turn it on after you have deployed the latest version.</p>
      {msg && <p className="text-[11px] text-chs-charcoal mt-1">{msg}</p>}
      <button disabled={busy || on === null} onClick={() => set(!on)} className="mt-2 px-4 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">
        {on ? "Turn OFF" : "Turn ON"}
      </button>
    </div>
  );
}
