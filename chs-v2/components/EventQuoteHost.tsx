"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// Quotation for the extra services around an event (ushers, catering, decoration and so on) with a payment
// schedule. It is paid to the venue directly and recorded here; the CHS booking payment is separate.

interface Quote {
  id: string; status: string; title: string | null; note: string | null; valid_until: string; total: number;
  lines: { label: string; qty: number; unit_price: number }[];
  milestones: { id: string; label: string; amount: number; due_date: string; paid_at: string | null; paid_method: string | null }[];
}
interface L { label: string; qty: string; price: string }
interface M { label: string; amount: string; due: string }

const day = (iso: string) => new Date(iso + "T12:00:00+01:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const todayPlus = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

export default function EventQuoteHost({ bookingId, canSend }: { bookingId: string; canSend: boolean }) {
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<L[]>([{ label: "", qty: "1", price: "" }]);
  const [ms, setMs] = useState<M[]>([{ label: "Deposit", amount: "", due: todayPlus(3) }]);
  const [valid, setValid] = useState(todayPlus(14));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_event_quote_host", { p_booking_id: bookingId });
    if (error) { setErr(error.message); setQuote(null); } else setQuote((data as Quote | null) ?? null);
  }, [bookingId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const msTotal = ms.reduce((s, m) => s + (Number(m.amount) || 0), 0);

  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string, after?: () => void) {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await p;
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(ok); after?.(); load();
  }

  function send() {
    return run(supabase.rpc("send_event_quote", {
      p_booking_id: bookingId, p_title: "Event extras",
      p_lines: lines.filter((l) => l.label.trim()).map((l) => ({ label: l.label, qty: Number(l.qty) || 1, unit_price: Number(l.price) })),
      p_milestones: ms.map((m) => ({ label: m.label, amount: Number(m.amount), due_date: m.due })),
      p_valid_until: valid, p_note: note || null,
    }), "Quotation sent to the client.", () => setEditing(false));
  }

  function renderForm() {
    return (
      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <div key={i} className="flex gap-1">
            <input value={l.label} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Item (e.g. 4 ushers)" className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-[11px]" />
            <input value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} inputMode="numeric" className="w-10 border border-gray-300 rounded px-1 py-1 text-[11px]" />
            <input value={l.price} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} inputMode="decimal" placeholder="₦ each" className="w-20 border border-gray-300 rounded px-2 py-1 text-[11px]" />
          </div>
        ))}
        <button type="button" onClick={() => setLines([...lines, { label: "", qty: "1", price: "" }])} className="text-[10px] underline">+ add line</button>
        <p className="text-[11px] font-semibold">Total {formatNaira(total)}</p>
        <p className="text-[10px] text-gray-500">Payment dates (must add up to the total, on or before the event date)</p>
        {ms.map((m, i) => (
          <div key={i} className="flex gap-1">
            <input value={m.label} onChange={(e) => setMs(ms.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-[11px]" />
            <input value={m.amount} onChange={(e) => setMs(ms.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} inputMode="decimal" placeholder="₦" className="w-20 border border-gray-300 rounded px-2 py-1 text-[11px]" />
            <input type="date" value={m.due} onChange={(e) => setMs(ms.map((x, j) => j === i ? { ...x, due: e.target.value } : x))} className="border border-gray-300 rounded px-1 py-1 text-[11px]" />
          </div>
        ))}
        <button type="button" onClick={() => setMs([...ms, { label: "Balance", amount: "", due: todayPlus(7) }])} className="text-[10px] underline">+ add payment date</button>
        <p className={`text-[10px] ${msTotal === total ? "text-green-700" : "text-red-600"}`}>Payments add up to {formatNaira(msTotal)}</p>
        <label className="block text-[10px] text-gray-500">Valid until <input type="date" value={valid} onChange={(e) => setValid(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 text-[11px]" /></label>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note to the client (optional)" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
        <div className="flex gap-2">
          <button disabled={busy || total <= 0 || msTotal !== total} onClick={send} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Send quotation</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1 rounded-full border text-[10px]">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-chs-charcoal">Quotation for extra services</p>
      {quote === undefined && <p className="text-[10px] text-gray-400">Loading…</p>}
      {quote && !editing && (
        <div className="border border-gray-200 rounded p-2 text-[11px] space-y-0.5">
          <p className="font-semibold">{formatNaira(quote.total)} · <span className="capitalize">{quote.status}</span> · valid until {day(quote.valid_until)}</p>
          {quote.lines.map((l, i) => <p key={i} className="text-gray-600">{l.qty} × {l.label} @ {formatNaira(l.unit_price)}</p>)}
          {quote.milestones.map((m) => (
            <div key={m.id} className="flex justify-between items-center gap-2 border-t border-gray-100 pt-0.5">
              <span>{m.label}: {formatNaira(m.amount)} by {day(m.due_date)}{m.paid_at ? ` · received (${m.paid_method})` : ""}</span>
              {canSend && quote.status === "accepted" && !m.paid_at && (
                <span className="flex gap-1">{["cash", "transfer", "pos"].map((x) => (
                  <button key={x} disabled={busy} onClick={() => run(supabase.rpc("mark_quote_milestone_paid", { p_milestone_id: m.id, p_method: x }), "Payment recorded in your income.")} className="text-[10px] px-1.5 py-0.5 rounded-full border border-green-600 text-green-700">{x}</button>
                ))}</span>
              )}
            </div>
          ))}
          {canSend && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(true)} className="text-[10px] px-2 py-0.5 rounded-full border">Send a new version</button>
              {!quote.milestones.some((m) => m.paid_at) && <button disabled={busy} onClick={() => run(supabase.rpc("withdraw_event_quote", { p_quote_id: quote.id }), "Quotation withdrawn.")} className="text-[10px] px-2 py-0.5 rounded-full border border-red-300 text-red-600">Withdraw</button>}
            </div>
          )}
        </div>
      )}
      {quote === null && !editing && (canSend
        ? <button onClick={() => setEditing(true)} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold">Create a quotation</button>
        : <p className="text-[10px] text-gray-400">No quotation sent.</p>)}
      {editing && canSend && renderForm()}
      {msg && <p className="text-[10px] text-green-700">{msg}</p>}
      {err && <p className="text-[10px] text-red-600">{err}</p>}
    </div>
  );
}
