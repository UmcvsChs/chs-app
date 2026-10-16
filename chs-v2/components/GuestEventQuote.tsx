"use client";

import ConfirmPay from "@/components/ConfirmPay";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// The client's view of the venue's quotation for extra event services. Paid through CHS, which holds the money and remits it.

interface Quote {
  id: string; status: string; note: string | null; valid_until: string; total: number;
  lines: { label: string; qty: number; unit_price: number }[];
  milestones: { id: string; label: string; amount: number; due_date: string; paid_at: string | null; paid_method?: string | null; payment_ref?: string | null; fee?: number }[];
}
const day = (iso: string) => new Date(iso + "T12:00:00+01:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default function GuestEventQuote({ bookingId }: { bookingId: string }) {
  const [q, setQ] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_event_quote", { p_booking_id: bookingId });
    setQ((data as Quote | null) ?? null);
  }, [bookingId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!q) return null;
  async function respond(accept: boolean) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("respond_event_quote", { p_quote_id: q!.id, p_accept: accept });
    setBusy(false);
    if (error) setErr(error.message); else load();
  }

  async function pay(id: string) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("pay_quote_milestone", { p_milestone: id });
    setBusy(false);
    if (error) setErr(error.message === "insufficient_balance" ? "NEEDS_FUNDS" : error.message); else load();
  }

  return (
    <div className="mt-3 border border-gray-200 rounded-xl p-3 text-xs space-y-1">
      <p className="text-sm font-semibold">📄 Quotation for extra services · <span className="capitalize">{q.status}</span></p>
      {q.lines.map((l, i) => <p key={i}>{l.qty} × {l.label} · {formatNaira(l.unit_price)}</p>)}
      <p className="font-semibold">Total {formatNaira(q.total)}{q.status === "sent" ? ` · valid until ${day(q.valid_until)}` : ""}</p>
      {q.note && <p className="italic text-gray-600">“{q.note}”</p>}
      <div className="border-t border-gray-100 pt-1 space-y-1">
        {q.milestones.map((m) => {
          const next = q.status === "accepted" && !m.paid_at && q.milestones.find((x) => !x.paid_at)?.id === m.id;
          return (
            <div key={m.id} className="flex justify-between items-center gap-2">
              <span>{m.label}: {formatNaira(m.amount)}{m.fee ? ` + ${formatNaira(m.fee)} CHS fee` : ""} by {day(m.due_date)}{m.paid_at ? ` ✓ paid${m.payment_ref ? ` · receipt ${m.payment_ref}` : ""}` : ""}</span>
              {next && <ConfirmPay busy={busy} amountText={formatNaira(m.amount + (m.fee || 0))} whatFor="for this instalment of your quotation" onConfirm={() => pay(m.id)} className="px-2.5 py-1 rounded-full bg-chs-charcoal text-white font-semibold whitespace-nowrap" label={`Pay ${formatNaira(m.amount + (m.fee || 0))} from wallet`} />}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500">Once you accept, pay each instalment from your CHS wallet, in order. Like your booking payment, CHS holds it safely and pays the venue after your event. A small CHS service fee is added to each payment. If the venue cancels, or you cancel in good time, you are refunded under the same cancellation policy as your booking.</p>
      {q.status === "sent" && (
        <div className="flex gap-2 pt-1">
          <button disabled={busy} onClick={() => respond(true)} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white font-semibold">Accept</button>
          <button disabled={busy} onClick={() => respond(false)} className="px-3 py-1.5 rounded-full border border-gray-300">Decline</button>
        </div>
      )}
      {err === "NEEDS_FUNDS" ? <p className="text-red-600">Your wallet balance is too low. <a href="/wallet" className="underline font-semibold">Fund your wallet</a>, then pay.</p> : err && <p className="text-red-600">{err}</p>}
    </div>
  );
}
