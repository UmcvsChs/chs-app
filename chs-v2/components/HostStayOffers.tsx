"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// For one hotel or shortlet: long-stay discounts (applied automatically to the price a guest sees) and the group /
// corporate enquiries guests have sent.
interface Enq { id: string; contact_name: string; organisation: string | null; guests: number; rooms: number | null; check_in: string | null; check_out: string | null; purpose: string | null; message: string | null; created_at: string }

export default function HostStayOffers({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [weekly, setWeekly] = useState("0");
  const [monthly, setMonthly] = useState("0");
  const [enq, setEnq] = useState<Enq[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, e] = await Promise.all([
      supabase.from("properties").select("weekly_discount_pct, monthly_discount_pct").eq("id", propertyId).single(),
      supabase.rpc("get_property_group_enquiries", { p_property: propertyId }),
    ]);
    if (p.data) { setWeekly(String(p.data.weekly_discount_pct ?? 0)); setMonthly(String(p.data.monthly_discount_pct ?? 0)); }
    setEnq((e.data as Enq[]) || []);
  }, [propertyId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save() {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("host_save_long_stay_discount", { p_property: propertyId, p_weekly: Number(weekly) || 0, p_monthly: Number(monthly) || 0 });
    setBusy(false);
    if (error) setErr(error.message); else setMsg("Saved. Guests see the discount in their price.");
  }

  return (
    <div className="mt-2 border border-gray-200 rounded-xl bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex justify-between items-center px-3 py-2 text-xs font-bold text-chs-charcoal">
        <span>🏷️ Long-stay discounts &amp; group enquiries{enq.length > 0 ? ` · ${enq.length} enquiry${enq.length > 1 ? "ies" : ""}` : ""}</span><span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[10px] text-gray-500">A percentage off the room price for longer stays. It is applied automatically; the guest sees it before booking.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-gray-600">7 nights or more (%)<input value={weekly} onChange={(e) => setWeekly(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-sm" /></label>
            <label className="text-[11px] text-gray-600">28 nights or more (%)<input value={monthly} onChange={(e) => setMonthly(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-sm" /></label>
          </div>
          <button disabled={busy} onClick={save} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Save discounts</button>
          {msg && <p className="text-[10px] text-green-700">{msg}</p>}
          {err && <p className="text-[10px] text-red-600">{err}</p>}
          <div className="border-t border-gray-100 pt-2">
            <p className="text-[11px] font-bold text-chs-charcoal mb-1">Group and corporate enquiries</p>
            {enq.length === 0 && <p className="text-[10px] text-gray-400">None yet.</p>}
            {enq.map((g) => (
              <div key={g.id} className="text-[11px] bg-gray-50 rounded px-2 py-1.5 mb-1">
                <p className="font-semibold">{g.contact_name}{g.organisation ? ` (${g.organisation})` : ""} · {g.guests} guests{g.rooms ? `, ${g.rooms} rooms` : ""}</p>
                <p className="text-gray-600">{g.check_in ? `${g.check_in}${g.check_out ? ` to ${g.check_out}` : ""}` : "Dates open"}{g.purpose ? ` · ${g.purpose}` : ""}</p>
                {g.message && <p className="text-gray-500 italic">“{g.message}”</p>}
                <p className="text-[10px] text-gray-400">CHS will help you reply to this enquiry.</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
