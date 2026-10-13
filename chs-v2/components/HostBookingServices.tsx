"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import ServiceThread from "@/components/ServiceThread";

// The services a guest asked for on one booking (ushers, caterer, live band, security, decoration and so on),
// and the host's answer to each: "we supply this", "you arrange this yourself", or "we cannot provide this".
// Every answer is shown to the guest on their booking and they are told at once.

export interface ServiceLine {
  id: string; service: string; label: string; quantity: number | null; status: string;
  provider_name: string | null; price: number | null; note: string | null; source?: string; decided_at: string | null;
  supplier_cost?: number | null; chs_provider?: string | null; chs_provider_contact?: string | null; chs_unable?: boolean;
  sourced_via?: string | null; provider_confirmed_at?: string | null; messages?: number; paid_at?: string | null; payment_ref?: string | null; payment_status?: string | null; relayed?: boolean;
}

export const SERVICE_STATUS: Record<string, { text: string; cls: string }> = {
  requested: { text: "Waiting for your answer", cls: "bg-amber-100 text-amber-800" },
  sourcing: { text: "With CHS: finding options", cls: "bg-purple-100 text-purple-800" },
  quoted: { text: "CHS proposal: your answer", cls: "bg-amber-100 text-amber-800" },
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
  const [rejectNote, setRejectNote] = useState("");
  const [showThread, setShowThread] = useState(false);
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

  async function call(fn: string, args: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErr(error.message); return false; }
    onChanged();
    return true;
  }

  const cost = line.supplier_cost ?? null;
  const priceNum = cost;

  return (
    <div className="border border-gray-200 rounded-lg p-2 bg-white">
      <div className="flex justify-between items-start gap-2">
        <p className="text-xs font-semibold text-chs-charcoal">
          {line.label}{line.quantity ? ` × ${line.quantity}` : ""}
          {line.source === "host" && <span className="ml-1 text-[9px] text-gray-400">(added by you)</span>}
        </p>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.text}</span>
      </div>
      {line.relayed === false && <p className="text-[10px] text-blue-800 bg-blue-50 rounded px-2 py-1 mt-1">📨 Your answer is with CHS, who will confirm it to the guest shortly.</p>}
      {line.status === "requested" && line.note && <p className="text-[11px] text-gray-600 italic mt-0.5">“{line.note}”</p>}
      {line.status !== "requested" && (
        <p className="text-[10px] text-gray-500 mt-0.5">
          {line.provider_name ? `By ${line.provider_name}. ` : ""}{line.price != null ? `Price ${formatNaira(line.price)}. ` : ""}{line.note ? `“${line.note}”` : ""}
        </p>
      )}
      {line.chs_unable && line.status === "requested" && (
        <p className="text-[10px] text-amber-800 bg-amber-50 rounded px-2 py-1 mt-1">CHS could not source this. Open the conversation below, then tell the guest you cannot provide it or that they arrange it themselves.</p>
      )}
      {line.status === "sourcing" && (
        <div className="mt-1.5 bg-purple-50 rounded-lg p-2">
          <p className="text-[10px] text-purple-900">CHS is finding someone to supply this. You will be told when there is a proposal. The guest only sees that you are arranging it.</p>
          {canAnswer && <button disabled={busy} onClick={() => call("host_cancel_referral", { p_line: line.id })} className="text-[10px] underline text-gray-500 mt-1">Take this back, I will answer it myself</button>}
        </div>
      )}
      {line.status === "quoted" && (
        <div className="mt-1.5 bg-amber-50 rounded-lg p-2 space-y-1.5">
          <p className="text-[11px] font-semibold text-amber-900">CHS can supply this: {line.chs_provider || "a provider"} at {cost != null ? formatNaira(cost) : "an agreed price"}. This is the price your guest will see; CHS takes its commission from the provider.</p>
          {line.chs_provider_contact && <p className="text-[10px] text-amber-900">Contact: {line.chs_provider_contact}</p>}
          {canAnswer && (
            <>
              <div className="flex flex-wrap gap-1.5">
                <button disabled={busy || priceNum == null} onClick={() => call("host_accept_service_quote", { p_line: line.id, p_guest_price: priceNum, p_note: null })} className="px-3 py-1 rounded-full bg-green-600 text-white text-[10px] font-semibold disabled:opacity-50">✓ Accept and confirm to the guest</button>
              </div>
              <div className="flex gap-1">
                <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Not right? Say why, CHS will look again" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
                <button disabled={busy || !rejectNote.trim()} onClick={() => call("host_reject_service_quote", { p_line: line.id, p_note: rejectNote.trim() })} className="px-3 py-1 rounded-full border border-gray-400 text-gray-700 text-[10px] font-semibold disabled:opacity-50">Ask for another</button>
              </div>
            </>
          )}
        </div>
      )}
      {line.status === "supplied" && line.paid_at && (
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-[10px] text-green-700">✓ Guest paid. {line.payment_status === "held" ? "CHS is holding it until the event." : line.payment_status === "released" ? "Paid out." : line.payment_status === "refunded" ? "Refunded to the guest." : ""} Receipt {line.payment_ref}</p>
          {canAnswer && line.payment_status === "held" && line.sourced_via !== "chs" && (
            <button disabled={busy} onClick={() => { const r = window.prompt("Reason for the refund (the guest will see it):"); if (r && r.trim()) call("host_refund_service_line", { p_line: line.id, p_reason: r.trim() }); }} className="text-[10px] px-1.5 py-0.5 rounded-full border border-red-300 text-red-600">Refund</button>
          )}
        </div>
      )}
      {line.status === "supplied" && !line.paid_at && line.price != null && line.price > 0 && <p className="text-[10px] text-amber-700 mt-1">Waiting for the guest to pay through CHS.</p>}
      {line.sourced_via === "chs" && line.status === "supplied" && (
        <p className="text-[10px] text-gray-500 mt-0.5">Sourced with CHS{line.chs_provider ? `: ${line.chs_provider}${line.chs_provider_contact ? ` (${line.chs_provider_contact})` : ""}` : ""}{cost != null ? `, agreed price ${formatNaira(cost)}` : ""}. {line.provider_confirmed_at ? "✓ CHS has confirmed the provider." : "CHS will confirm the provider is booked."}</p>
      )}
      {canAnswer && ["requested", "sourcing", "quoted", "supplied"].includes(line.status) && (line.sourced_via === "chs" || line.status === "sourcing" || line.status === "quoted" || (line.messages ?? 0) > 0 || showThread) && (
        <button onClick={() => setShowThread(!showThread)} className="text-[10px] underline text-gray-600 mt-1">{showThread ? "Hide" : "Open"} conversation with CHS{line.messages ? ` (${line.messages})` : ""}</button>
      )}
      {showThread && <ServiceThread lineId={line.id} me="host" onSent={onChanged} />}
      {err && !open && <p className="text-[10px] text-red-600 mt-1">{err}</p>}
      {canAnswer && !["requested", "cancelled", "sourcing", "quoted"].includes(line.status) && !editing && (
        <button onClick={() => setEditing(true)} className="text-[10px] underline text-gray-500 mt-1">Change my answer</button>
      )}
      {open && line.status !== "cancelled" && (
        <div className="mt-2 space-y-1.5 bg-gray-50 rounded-lg p-2">
          <div className="flex gap-1">
            <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Who supplies it (optional)" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
            <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="How many" className="w-20 border border-gray-300 rounded px-2 py-1 text-[11px]" />
          </div>
          <div className="flex gap-1">
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Price in naira (0 if included in the hall price)" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the guest (needed if you cannot provide it)" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
          {err && <p className="text-[10px] text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-1.5">
            <button disabled={busy} onClick={() => answer("supplied")} className="px-3 py-1 rounded-full bg-green-600 text-white text-[10px] font-semibold disabled:opacity-50">✓ We supply this</button>
            <button disabled={busy} onClick={() => answer("guest_arranges")} className="px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold disabled:opacity-50">Guest arranges</button>
            <button disabled={busy} onClick={() => answer("declined")} className="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold disabled:opacity-50">Cannot provide</button>
            {line.status === "requested" && <button disabled={busy} onClick={() => call("host_refer_services", { p_booking: bookingId, p_services: [line.service], p_note: note.trim() || null }).then((ok) => ok && setShowThread(true))} className="px-3 py-1 rounded-full bg-purple-600 text-white text-[10px] font-semibold disabled:opacity-50">🤝 Ask CHS to source it</button>}
            {editing && <button onClick={() => setEditing(false)} className="text-[10px] underline text-gray-500">Close</button>}
          </div>
          <p className="text-[10px] text-gray-400">Agree the price with the guest. The guest pays it through CHS, which holds it and pays you after the event, less 4%. Your answer shows on the guest&apos;s booking at once.</p>
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

  if (!lines && err) return <p className="text-[11px] text-red-600">{err}</p>;
  if (!lines) return <p className="text-[11px] text-gray-400">Loading services…</p>;
  const live = lines.filter((l) => l.status !== "cancelled");
  if (live.length === 0 && lines.length === 0) return <p className="text-[11px] text-gray-400">The guest has not asked for any extra services.</p>;
  const unanswered = lines.filter((l) => l.status === "requested" && !l.chs_unable);
  return (
    <div className="space-y-1.5">
      {canAnswer && unanswered.length > 1 && (
        <button onClick={async () => {
          const { error } = await supabase.rpc("host_refer_services", { p_booking: bookingId, p_services: unanswered.map((l) => l.service), p_note: null });
          if (error) setErr(error.message); else { load(); onChanged?.(); }
        }} className="w-full py-1.5 rounded-full border border-purple-400 text-purple-800 text-[11px] font-semibold">🤝 Ask CHS to source all {unanswered.length} unanswered services</button>
      )}
      {lines.map((l) => (
        <LineRow key={l.id + l.status + l.decided_at} bookingId={bookingId} line={l} canAnswer={canAnswer} onChanged={() => { load(); onChanged?.(); }} />
      ))}
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
