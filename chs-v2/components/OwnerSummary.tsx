"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// "At a glance": one screen across all of an owner's properties. What needs doing today, where the money is, and a
// quick row per property. Read-only; every number comes from one database call (get_owner_summary).
interface Summary {
  properties: { total: number; live: number; rented_or_sold: number; awaiting_verification: number; chs_managed: number };
  attention: { offers: number; applications: number; questions: number; visits_this_week: number; visits_to_mark: number; rent_ending_soon: number; notices_received: number; overdue_instalments: number; service_charges_due: number };
  money: { wallet: number; held_in_escrow: number; rent_awaiting_release: number; rent_released_30d: number; annual_rent_under_lease: number };
  list: { id: string; title: string; status: string; verification_status: string; purpose: string; price: number; chs_service: string; chs_tag: string | null; offers: number; applications: number; next_visit: string | null; lease_end: string | null }[];
}

const dt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

export default function OwnerSummary() {
  const [s, setS] = useState<Summary | null>(null);
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);

  useEffect(() => {
    supabase.rpc("get_owner_summary").then(({ data }) => setS(data as Summary | null));
  }, []);
  if (!s || s.properties.total === 0) return null;

  const a = s.attention;
  const todo: { n: number; label: string; urgent?: boolean }[] = [
    { n: a.visits_to_mark, label: "past visits to mark (showed up or no-show)", urgent: true },
    { n: a.overdue_instalments, label: "overdue rent instalments", urgent: true },
    { n: a.applications, label: "rental applications waiting for your decision" },
    { n: a.offers, label: "offers waiting for your decision" },
    { n: a.questions, label: "questions from buyers and tenants to answer" },
    { n: a.visits_this_week, label: "visits in the next 7 days" },
    { n: a.rent_ending_soon, label: "tenancies ending within 60 days" },
    { n: a.notices_received, label: "tenants who gave notice" },
  ].filter((x) => x.n > 0);

  const rows = [...s.list].sort((x, y) => (y.offers + y.applications) - (x.offers + x.applications));
  const shown = all ? rows : rows.slice(0, 6);

  return (
    <div className="bg-white text-chs-charcoal rounded-xl p-3 mt-4">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex justify-between items-center">
        <span className="text-sm font-bold">📋 At a glance</span>
        <span className="text-[10px] text-gray-400">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {open && (
        <>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {s.properties.total} properties · {s.properties.live} live · {s.properties.rented_or_sold} rented or sold
            {s.properties.chs_managed > 0 && ` · ${s.properties.chs_managed} managed by CHS`}
            {s.properties.awaiting_verification > 0 && ` · ${s.properties.awaiting_verification} awaiting verification`}
          </p>

          <p className="text-[10px] font-bold uppercase text-gray-500 mt-3 mb-1">Needs you</p>
          {todo.length === 0 ? (
            <p className="text-xs text-green-700">✓ Nothing is waiting for you.</p>
          ) : (
            <ul className="space-y-0.5">
              {todo.map((t) => (
                <li key={t.label} className={`text-xs ${t.urgent ? "text-chs-red font-semibold" : ""}`}><b>{t.n}</b> {t.label}</li>
              ))}
            </ul>
          )}
          {a.service_charges_due > 0 && <p className="text-xs mt-1">CHS service charges due: <b>{formatNaira(a.service_charges_due)}</b> (taken from your rent or sale proceeds).</p>}

          <p className="text-[10px] font-bold uppercase text-gray-500 mt-3 mb-1">Money</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
            <span className="text-gray-500">Wallet</span><span className="text-right font-semibold">{formatNaira(s.money.wallet)}</span>
            <span className="text-gray-500">Held in escrow</span><span className="text-right font-semibold">{formatNaira(s.money.held_in_escrow)}</span>
            <span className="text-gray-500">Rent awaiting release</span><span className="text-right font-semibold">{formatNaira(s.money.rent_awaiting_release)}</span>
            <span className="text-gray-500">Rent released, last 30 days</span><span className="text-right font-semibold">{formatNaira(s.money.rent_released_30d)}</span>
            <span className="text-gray-500">Annual rent under lease</span><span className="text-right font-semibold">{formatNaira(s.money.annual_rent_under_lease)}</span>
          </div>

          <p className="text-[10px] font-bold uppercase text-gray-500 mt-3 mb-1">Your properties</p>
          <div className="divide-y divide-gray-100">
            {shown.map((p) => (
              <div key={p.id} className="py-1.5 text-xs flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{p.title}{p.chs_service === "chs_managed" && <span className="ml-1 text-[9px] font-bold bg-chs-charcoal text-amber-300 px-1.5 py-0.5 rounded-full">CHS</span>}</p>
                  <p className="text-[10px] text-gray-500">{p.status}{p.verification_status !== "verified" ? " · awaiting verification" : ""}{p.lease_end ? ` · lease to ${dt(p.lease_end)}` : ""}{p.next_visit ? ` · visit ${dt(p.next_visit)}` : ""}</p>
                </div>
                <div className="text-right shrink-0 text-[10px] text-gray-600">
                  {p.applications > 0 && <p><b>{p.applications}</b> application{p.applications > 1 ? "s" : ""}</p>}
                  {p.offers > 0 && <p><b>{p.offers}</b> offer{p.offers > 1 ? "s" : ""}</p>}
                </div>
              </div>
            ))}
          </div>
          {rows.length > 6 && (
            <button type="button" onClick={() => setAll(!all)} className="mt-1.5 text-[11px] font-semibold text-chs-red underline">{all ? "Show fewer" : `Show all ${rows.length}`}</button>
          )}
        </>
      )}
    </div>
  );
}
