"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// The services a guest asked for on one booking (ushers, caterer, live band, security, decoration and so on),
// and the host's answer to each: "we supply this", "you arrange this yourself", or "we cannot provide this".
// Every answer is shown to the guest on their booking and they are told at once.

export interface ServiceLine {
  id: string; service: string; label: string; quantity: number | null; status: string;
  provider_name: string | null; price: number | null; note: string | null; source?: string; decided_at: string | null;
}

export const SERVICE_STATUS: Record<string, { text: string; cls: string }> = {
  requested: { text: "Waiting for your answer", cls: "bg-amber-100 text-amber-800" },
  supplied: { text: "We supply this", cls: "bg-green-100 text-green-800" },
  guest_arranges: { text: "Guest arranges", cls: "bg-blue-100 text-blue-800" },
  declined: { text: "Cannot provide", cls: "bg-red-100 text-red-700" },
  cancelled: { text: "Withdrawn by guest", cls: "bg-gray-100 text-gray-500" },
};

function LineRow({ bookingId, line, canAnswer, onChanged }: { bookingId: string; line: ServiceLine; canAnswer: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState(line.provider_name || "");
  const [price, setPrice] = useState(line.price != null ? String(line.price) : "");
  const [qty, setQty] = useState(line.quantity != null ? String(line.quantity) : "");
  const [note, setNote] = useState(line.status === "requested" ? "" : line.note || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const st = SERVICE_STATUS[line.status] || SERVICE_STATUS.requested;
  const open = canAnswer && (line.status === "requested" || editing);

  async function answer(status: "supplied" | "guest_arranges" | "declined") {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("host_set_service", {
      p_booking: bookingId, p_service: line.service, p_status: status,
      p_quantity: qty ? Number(qty) : null, p_price: price ? Number(price) : null,
      p_provider: provider.trim() || null, p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEditing(false);
    onChanged();
  }

  return (
    <div className="border border-gray-200 rounded-lg p-2 bg-white">
      <div className="flex justify-between items-start gap-2">
        <p className="text-xs font-semibold text-chs-charcoal">
          {line.label}{line.quantity ? ` × ${line.quantity}` : ""}
          {line.source === "host" && <span className="ml-1 text-[9px] text-gray-400">(added by you)</span>}
        </p>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.text}</span>
      </div>
      {line.status === "requested" && line.note && <p className="text-[11px] text-gray-600 italic mt-0.5">“{line.note}”</p>}
      {line.status !== "requested" && (
        <p className="text-[10px] text-gray-500 mt-0.5">
          {line.provider_name ? `By ${line.provider_name}. ` : ""}{line.price != null ? `Price ${formatNaira(line.price)}. ` : ""}{line.note ? `“${line.note}”` : ""}
        </p>
      )}
      {canAnswer && line.status !== "requested" && line.status !== "cancelled" && !editing && (
        <button onClick={() => setEditing(true)} className="text-[10px] underline text-gray-500 mt-1">Change my answer</button>
      )}
      {open && line.status !== "cancelled" && (
        <div className="mt-2 space-y-1.5 bg-gray-50 rounded-lg p-2">
          <div className="flex gap-1">
            <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Who supplies it (optional)" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
            <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="How many" className="w-20 border border-gray-300 rounded px-2 py-1 text-[11px]" />
          </div>
          <div className="flex gap-1">
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Price in naira (optional)" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the guest (needed if you cannot provide it)" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
          {err && <p className="text-[10px] text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-1.5">
            <button disabled={busy} onClick={() => answer("supplied")} className="px-3 py-1 rounded-full bg-green-600 text-white text-[10px] font-semibold disabled:opacity-50">✓ We supply this</button>
            <button disabled={busy} onClick={() => answer("guest_arranges")} className="px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold disabled:opacity-50">Guest arranges</button>
            <button disabled={busy} onClick={() => answer("declined")} className="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold disabled:opacity-50">Cannot provide</button>
            {editing && <button onClick={() => setEditing(false)} className="text-[10px] underline text-gray-500">Close</button>}
          </div>
          <p className="text-[10px] text-gray-400">Agree the price with the guest. Services are paid to the venue directly (see Quotation); your answer shows on the guest&apos;s booking at once.</p>
        </div>
      )}
    </div>
  );
}

export default function HostBookingServices({ bookingId, canAnswer, onChanged }: { bookingId: string; canAnswer: boolean; onChanged?: () => void }) {
  const [lines, setLines] = useState<ServiceLine[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_booking_services_host", { p_booking: bookingId });
    if (error) { setErr(error.message); return; }
    setLines((data as ServiceLine[]) || []);
  }, [bookingId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (err) return <p className="text-[11px] text-red-600">{err}</p>;
  if (!lines) return <p className="text-[11px] text-gray-400">Loading services…</p>;
  const live = lines.filter((l) => l.status !== "cancelled");
  if (live.length === 0 && lines.length === 0) return <p className="text-[11px] text-gray-400">The guest has not asked for any extra services.</p>;
  return (
    <div className="space-y-1.5">
      {lines.map((l) => (
        <LineRow key={l.id + l.status + l.decided_at} bookingId={bookingId} line={l} canAnswer={canAnswer} onChanged={() => { load(); onChanged?.(); }} />
      ))}
    </div>
  );
}
