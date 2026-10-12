"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Owner setting on a CHS-managed rental: which rent plans tenants may choose. Full-year is always allowed.
// CHS releases each instalment to the owner like annual rent but does not guarantee an instalment a tenant fails to pay.
export default function RentPlanSettings({ propertyId }: { propertyId: string }) {
  const [plans, setPlans] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("properties").select("rent_plans_allowed").eq("id", propertyId).maybeSingle()
      .then(({ data }) => setPlans((data?.rent_plans_allowed as string[] | undefined) ?? ["annual"]));
  }, [propertyId]);

  if (!plans) return null;
  const has = (p: string) => plans.includes(p);
  async function toggle(p: string) {
    const next = has(p) ? plans!.filter((x) => x !== p) : [...plans!, p];
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc("set_rent_plans", { p_property: propertyId, p_plans: next });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setPlans((data as { plans: string[] }).plans);
    setMsg("Saved.");
  }

  return (
    <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
      <p className="text-xs font-bold text-chs-charcoal">Let tenants pay in instalments</p>
      <p className="text-[10px] text-gray-500 mb-1.5">Tenants can always pay the full year. Tick to also allow quarterly or monthly rent. Each instalment goes into CHS escrow and is released to you after the usual grace period. CHS does not guarantee an instalment a tenant fails to pay, and your CHS management fee is taken in equal parts from each instalment.</p>
      {(["quarterly", "monthly"] as const).map((p) => (
        <label key={p} className="flex items-center gap-1.5 text-[11px] text-gray-700">
          <input type="checkbox" checked={has(p)} disabled={busy} onChange={() => toggle(p)} /> {p === "quarterly" ? "Quarterly (4 payments)" : "Monthly (12 payments)"}
        </label>
      ))}
      {msg && <p className="text-[10px] text-gray-500 mt-1">{msg}</p>}
    </div>
  );
}
