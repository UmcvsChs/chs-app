"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";

// Admin queue of open listing reports. Dismiss, tell the owner to fix it, or take the listing down; the owner sees
// the note, the reporter is thanked, and the action is written to the audit log.
interface Report { id: string; property_id: string; title: string; verification_status: string; reason: string; details: string | null; created_at: string; open_reporters: number }

export default function AdminListingReports() {
  const [rows, setRows] = useState<Report[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_listing_reports");
    if (error) setErr(error.message); else setRows(data as Report[]);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(id: string, action: "dismiss" | "warn_owner" | "hide_listing") {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("admin_resolve_listing_report", { p_report_id: id, p_action: action, p_note: notes[id] || "" });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    load();
  }

  if (!rows) return <p className="text-xs text-gray-500">{err ?? "Loading…"}</p>;
  return (
    <div className="space-y-2">
      <h2 className="font-serif text-lg font-bold text-chs-charcoal">Listing reports ({rows.length})</h2>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {rows.length === 0 && <p className="text-xs text-gray-500">No open reports.</p>}
      {rows.map((r) => (
        <div key={r.id} className="border border-gray-200 rounded-lg p-3 text-xs bg-white">
          <p className="font-semibold">{r.title} <span className="font-normal text-gray-500">· {r.verification_status}</span></p>
          <p>{r.reason.replace(/_/g, " ")}{r.open_reporters > 1 ? ` · ${r.open_reporters} people have reported this listing` : ""}</p>
          {r.details && <p className="italic text-gray-600">“{r.details}”</p>}
          <p className="text-[10px] text-gray-400">{formatDateTime(r.created_at)} · <Link href={`/property/${r.property_id}`} className="underline">open listing</Link></p>
          <input value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} placeholder="Note (the owner sees it; required to warn or take down)" className="w-full mt-2 border border-gray-300 rounded px-2 py-1" />
          <div className="flex gap-2 mt-2">
            <button disabled={busy} onClick={() => act(r.id, "dismiss")} className="px-3 py-1 rounded-full border">Dismiss</button>
            <button disabled={busy} onClick={() => act(r.id, "warn_owner")} className="px-3 py-1 rounded-full border border-amber-500 text-amber-700">Tell owner to fix</button>
            <button disabled={busy} onClick={() => act(r.id, "hide_listing")} className="px-3 py-1 rounded-full bg-red-600 text-white">Take listing down</button>
          </div>
        </div>
      ))}
    </div>
  );
}
