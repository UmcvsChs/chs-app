"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";

// Admin queue: owners asking CHS to manage their property, and owners asking to end it.
// Approving turns on the Managed & Advertised by CHS stamp and issues the tag.
interface Row { capacity: string | null; documents: { label: string; url: string }[]; agreed_terms: Record<string, number> | null; id: string; property_id: string; title: string; location_area: string | null; verification_status: string; listed_as: string; purposes: string[]; owner_note: string | null; fee_terms: string; accepted_at: string; status: string; end_reason: string | null; owner_name: string; owner_id_verified: boolean; chs_tag: string | null; created_at: string }

type HotelForm = { base: string; central: string; incentive: string; term: string; min: string };
const HOTEL_DEFAULT: HotelForm = { base: "3", central: "2", incentive: "10", term: "36", min: "" };

export default function AdminManagementMandates({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hotel, setHotel] = useState<Record<string, HotelForm>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_management_mandates");
    if (error) setErr(error.message); else setRows(data as Row[]);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const setField = (id: string, k: keyof HotelForm, v: string) => setHotel((cur) => ({ ...cur, [id]: { ...(cur[id] ?? HOTEL_DEFAULT), [k]: v } }));

  async function act(id: string, decision: "approve" | "decline" | "end") {
    setBusy(true); setErr(null);
    const h = hotel[id] ?? HOTEL_DEFAULT;
    const row = rows?.find((r) => r.id === id);
    const agreed = row?.purposes.includes("hotel")
      ? { base_pct: Number(h.base), central_pct: Number(h.central), incentive_pct: Number(h.incentive), term_months: Number(h.term), min_monthly: h.min ? Number(h.min.replace(/\D/g, "")) : 0 }
      : null;
    const { error } = await supabase.rpc("admin_decide_management_v2", { p_id: id, p_decision: decision, p_note: notes[id] || null, p_documents_checked: !!checked[id], p_agreed_terms: agreed });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    load(); onChanged?.();
  }

  if (!rows) return <p className="text-xs text-gray-500">{err ?? "Loading…"}</p>;
  return (
    <div className="space-y-2 mb-6">
      <h2 className="font-serif text-lg font-bold text-chs-charcoal">Owners asking CHS to manage ({rows.length})</h2>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {rows.length === 0 && <p className="text-xs text-gray-500">No open requests.</p>}
      {rows.map((r) => (
        <div key={r.id} className="border border-amber-300 rounded-lg p-3 text-xs bg-amber-50">
          <p className="font-semibold">{r.status === "end_requested" ? "ENDING: " : ""}{r.title} <span className="font-normal text-gray-500">· {r.location_area} · listed for {r.listed_as} · {r.verification_status}</span></p>
          <p>Owner: {r.owner_name} {r.owner_id_verified ? "(ID verified)" : "(ID NOT verified)"} · wants CHS to manage for: <b>{r.purposes.join(", ")}</b></p>
          {r.owner_note && <p className="italic text-gray-600">“{r.owner_note}”</p>}
          {r.end_reason && <p className="text-red-700">Reason to end: {r.end_reason}</p>}
          <p className="text-[10px] text-gray-500 whitespace-pre-line">Fees shown to the owner: {r.fee_terms}</p>
          <p className="text-[10px] text-gray-400">Terms accepted {formatDateTime(r.accepted_at)} · <Link href={`/property/${r.property_id}`} className="underline">open listing</Link></p>
          {r.verification_status !== "verified" && r.status === "pending" && <p className="text-[11px] text-amber-800 mt-1">The listing is not verified yet. Verify it first (Properties tab), then approve.</p>}
          <p className="mt-1">Capacity: <b>{r.capacity ?? "—"}</b>. Documents:</p>
          <ul className="list-disc ml-4">{(r.documents ?? []).map((d) => <li key={d.label}><a href={d.url} target="_blank" rel="noopener noreferrer" className="underline">{d.label}</a></li>)}</ul>
          {r.status === "pending" && r.purposes.includes("hotel") && (
            <div className="mt-2 bg-white border border-gray-200 rounded p-2 grid grid-cols-2 gap-1.5">
              <p className="col-span-2 font-semibold">Agreed hotel terms (standard offer is pre-filled)</p>
              {([["base", "Base fee % (management)", "3"], ["central", "Central services %", "2"], ["incentive", "Incentive % of GOP", "10"], ["term", "Term (months)", "36"]] as const).map(([k, label, dflt]) => (
                <label key={k} className="text-[10px]">{label}<input value={hotel[r.id]?.[k] ?? dflt} onChange={(e) => setField(r.id, k, e.target.value)} className="w-full border border-gray-300 rounded px-1.5 py-1" /></label>
              ))}
              <label className="col-span-2 text-[10px]">Monthly minimum fee (₦)<input value={hotel[r.id]?.min ?? ""} onChange={(e) => setField(r.id, "min", e.target.value)} className="w-full border border-gray-300 rounded px-1.5 py-1" /></label>
            </div>
          )}
          {r.status === "pending" && (
            <label className="flex items-start gap-2 mt-2"><input type="checkbox" checked={!!checked[r.id]} onChange={(e) => setChecked({ ...checked, [r.id]: e.target.checked })} className="mt-0.5" /><span>I have checked that the documents are genuine and give the owner authority to hand this property to CHS.</span></label>
          )}
          <input value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Note to the owner (required to decline)" className="w-full mt-2 border border-gray-300 rounded px-2 py-1" />
          <div className="flex gap-2 mt-2">
            {r.status === "pending" ? (
              <>
                <button disabled={busy || r.verification_status !== "verified" || !checked[r.id]} onClick={() => act(r.id, "approve")} className="px-3 py-1 rounded-full bg-green-700 text-white disabled:opacity-50">Approve and stamp</button>
                <button disabled={busy} onClick={() => act(r.id, "decline")} className="px-3 py-1 rounded-full border border-red-400 text-red-700">Decline</button>
              </>
            ) : (
              <button disabled={busy} onClick={() => act(r.id, "end")} className="px-3 py-1 rounded-full bg-red-600 text-white">End management and remove stamp</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
