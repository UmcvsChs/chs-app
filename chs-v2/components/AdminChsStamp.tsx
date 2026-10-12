"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminManagementMandates from "./AdminManagementMandates";

// Admin: award, change or remove the CHS stamp on a listing. The tag ID is issued automatically the first time, and
// is kept if the stamp is removed and given back later. Owners and agents cannot do any of this themselves.
interface Row { id: string; title: string; location_area: string | null; purpose: string; reference_number: string | null; verification_status: string; chs_service: string; chs_tag: string | null; owner_name: string | null }

const LEVELS = [
  { v: "chs_managed", label: "Managed & Advertised" },
  { v: "chs_advertised", label: "Advertised only" },
  { v: "independent", label: "Remove stamp" },
] as const;

export default function AdminChsStamp() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    const { data, error } = await supabase.rpc("admin_chs_stamp_list", { p_query: query });
    if (error) setErr(error.message); else { setErr(null); setRows(data as Row[]); }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load("");
  }, [load]);

  async function setLevel(r: Row, level: string) {
    if (level === "independent" && !window.confirm(`Remove the CHS stamp from "${r.title}"? The tag ${r.chs_tag} will show as no longer active.`)) return;
    setBusy(true); setErr(null); setMsg(null);
    const { data, error } = await supabase.rpc("admin_set_chs_service", { p_property: r.id, p_level: level });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const t = (data as { tag: string }).tag;
    setMsg(level === "independent" ? "Stamp removed." : `Done. Tag ${t}.`);
    load(q);
  }

  return (
    <div className="space-y-2">
      <AdminManagementMandates onChanged={() => load(q)} />
      <h2 className="font-serif text-lg font-bold text-chs-charcoal">CHS stamp</h2>
      <p className="text-xs text-gray-600">Search for a listing by title, area, reference number or tag, then award the stamp. Empty search shows the listings already stamped. The tag ID is created for you.</p>
      <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, area, PROP-… or CHS-…" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs" />
        <button className="px-4 py-2 rounded-full bg-chs-charcoal text-white text-xs font-bold">Search</button>
      </form>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {msg && <p className="text-xs text-green-700">{msg}</p>}
      {rows && rows.length === 0 && <p className="text-xs text-gray-500">Nothing found.</p>}
      {rows?.map((r) => (
        <div key={r.id} className="border border-gray-200 rounded-lg p-3 text-xs bg-white">
          <p className="font-semibold">{r.title} <span className="font-normal text-gray-500">· {r.location_area} · {r.purpose} · {r.verification_status}</span></p>
          <p className="text-gray-500">Owner: {r.owner_name ?? "—"}{r.reference_number ? ` · ${r.reference_number}` : ""}</p>
          <p className="mt-1">Now: <b>{r.chs_service === "chs_managed" ? "Managed & Advertised" : r.chs_service === "chs_advertised" ? "Advertised only" : "No stamp"}</b>{r.chs_tag ? <span className="font-mono"> · {r.chs_tag}</span> : null}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {LEVELS.filter((l) => l.v !== r.chs_service && !(l.v === "independent" && r.chs_service === "independent")).map((l) => (
              <button key={l.v} disabled={busy} onClick={() => setLevel(r, l.v)}
                className={`px-3 py-1 rounded-full border ${l.v === "independent" ? "border-red-400 text-red-700" : "border-chs-charcoal"}`}>{l.label}</button>
            ))}
            <Link href={`/property/${r.id}`} className="px-3 py-1 underline">Open listing</Link>
            {r.chs_service !== "independent" && <Link href={`/chs-stamp/${r.id}`} className="px-3 py-1 underline">Printable stamp sheet</Link>}
          </div>
        </div>
      ))}
    </div>
  );
}
