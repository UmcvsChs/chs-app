"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime } from "@/lib/format";

// Host answers waiting to be relayed to the guest. CHS relays every request to the host, and now every answer back:
// the guest keeps seeing "with the host" until an admin releases the reply here (or the relay time runs out and it is
// released automatically, with any note that contains contact details removed).

interface Svc { service: string; label: string; quantity: number | null; status: string; price: number | null; provider_name: string | null; note: string | null }
interface Row {
  id: string; ref: string; cat?: string; property_title: string; host_name: string | null; guest_name: string | null; event_type: string | null; check_in: string; check_out: string;
  status: string; amount_if_confirmed: number; decision: "confirmed" | "declined" | null; note: string | null; reply_at: string | null; release_at: string | null;
  minutes_left: number | null; services: Svc[];
}
const SVC_TEXT: Record<string, string> = { supplied: "Venue supplies", guest_arranges: "Guest arranges", declined: "Cannot provide", requested: "Back under review" };

function Card({ r, onDone }: { r: Row; onDone: () => void }) {
  const [note, setNote] = useState(r.note || "");
  const [svcNotes, setSvcNotes] = useState<Record<string, string>>(() => Object.fromEntries(r.services.map((s) => [s.service, s.note || ""])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function release() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("admin_release_host_reply", { p_booking: r.id, p_note: r.decision ? note : null, p_service_notes: r.services.length ? svcNotes : null });
    setBusy(false);
    if (error) setErr(error.message); else onDone();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1.5">
      <div className="flex justify-between items-start gap-2">
        <p className="text-sm font-bold text-chs-charcoal">{r.property_title} <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 align-middle">{r.cat === "event" ? "🎉 Event Centre" : r.cat === "hotel" ? "🏨 Hotel & Lodge" : r.cat === "shortlet" ? "🏠 Shortlet" : "Hire"}</span></p>
        {r.decision && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${r.decision === "confirmed" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>{r.decision === "confirmed" ? "Host ACCEPTED" : "Host DECLINED"}</span>}
      </div>
      <p className="text-[11px] text-gray-600">{r.event_type || "Booking"} · {r.check_in}{r.check_out !== r.check_in ? ` to ${r.check_out}` : ""} · Ref {r.ref}</p>
      <p className="text-[11px] text-gray-500">Host: {r.host_name || "?"} · Guest: {r.guest_name || "?"} · {formatNaira(r.amount_if_confirmed)} if confirmed</p>
      {r.reply_at && <p className="text-[10px] text-gray-400">Replied {formatDateTime(r.reply_at)}{r.minutes_left != null ? ` · released automatically in ${r.minutes_left} min` : ""}</p>}
      {!r.decision && r.minutes_left != null && <p className="text-[10px] text-gray-400">Released automatically in {r.minutes_left} min</p>}

      {r.decision && (
        <div>
          <label className="text-[10px] text-gray-500">Note the guest will see (edit or clear it)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="No note" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
        </div>
      )}
      {r.services.length > 0 && (
        <div className="space-y-1 border-t border-gray-100 pt-1.5">
          <p className="text-[10px] font-bold text-gray-600">Service answers ({r.services.length})</p>
          {r.services.map((s) => (
            <div key={s.service} className="bg-gray-50 rounded p-1.5 space-y-1">
              <p className="text-[11px] text-chs-charcoal"><b>{s.label}{s.quantity ? ` × ${s.quantity}` : ""}</b> · {SVC_TEXT[s.status] || s.status}{s.status === "supplied" ? (s.price && s.price > 0 ? ` · ${formatNaira(s.price)}` : " · included") : ""}</p>
              <input value={svcNotes[s.service] ?? ""} onChange={(e) => setSvcNotes({ ...svcNotes, [s.service]: e.target.value })} maxLength={300} placeholder="No note" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
            </div>
          ))}
        </div>
      )}
      {err && <p className="text-[10px] text-red-600">{err}</p>}
      <button disabled={busy} onClick={release} className="px-4 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">✓ Release to the guest</button>
    </div>
  );
}

export default function AdminHostReplies() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_host_replies");
    if (error) { setErr(error.message); return; }
    setRows((data as Row[]) || []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  if (err) return <p className="text-xs text-red-600">{err}</p>;
  if (!rows) return <p className="text-xs text-gray-400">Loading…</p>;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-serif text-lg font-bold text-chs-charcoal">📨 Host replies to relay</h2>
        <p className="text-[11px] text-gray-500">CHS passes every request to the host and every answer back to the guest. Check each reply (and remove any contact details from the notes), then release it. The guest&apos;s payment time starts when you release. Unreleased replies go out automatically when the relay time runs out.</p>
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Nothing waiting. When a host answers a request or a service, it appears here.</p>}
      {rows.map((r) => <Card key={r.id + (r.reply_at || "") + r.services.length} r={r} onDone={load} />)}
    </div>
  );
}
