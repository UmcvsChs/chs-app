"use client";

import { useEffect, useState } from "react";
import { embeddedOne } from "@/lib/embedded";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import RaiseDisputeForm from "@/components/RaiseDisputeForm";
import TransactionsPanel from "@/components/TransactionsPanel";
import { Claim, CLAIM_STATUS, claimDay } from "@/components/ClaimTypes";

// Cancelled bookings and what came back to the wallet; any of them can be questioned.
interface Row {
  id: string; check_in: string; check_out: string; total_price: number; status: string; payment_status: string | null;
  cancellation_refund_amount: number | null; host_decision_note: string | null; properties: { title: string; owner_id: string }[] | null;
}
const day = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00+01:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default function RefundsPanel() {
  const { session } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [cErr, setCErr] = useState<string | null>(null);
  const loadClaims = async () => { const { data } = await supabase.rpc("get_my_claims"); setClaims((data as Claim[]) || []); };
  async function act(p: PromiseLike<{ error: { message: string } | null }>) { setCErr(null); const { error } = await p; if (error) setCErr(error.message); loadClaims(); }

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClaims();
    supabase.from("shortlet_bookings").select("id, check_in, check_out, total_price, status, payment_status, cancellation_refund_amount, host_decision_note, properties(title, owner_id)")
      .eq("guest_id", session.user.id).in("status", ["cancelled", "declined", "expired"]).order("check_in", { ascending: false })
      .then(({ data }) => setRows((data as unknown as Row[]) || []));
  }, [session]);

  if (!rows) return <p className="text-xs text-gray-400 text-center py-10">Loading…</p>;
  return (
    <div className="px-4 py-4 space-y-3">
      {rows.length === 0 && (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">↩️</p>
          <p className="text-sm font-semibold text-chs-charcoal">No cancelled bookings</p>
          <p className="text-xs text-gray-400 mt-1">If you cancel a booking, or a venue cancels one, the refund and its status appear here.</p>
        </div>
      )}
      {claims.length > 0 && <p className="text-xs font-bold text-chs-charcoal">My refund and date-move requests</p>}
      {cErr && <p className="text-xs text-red-600">{cErr}</p>}
      {claims.map((c) => (
        <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex justify-between gap-2"><p className="text-sm font-bold text-chs-charcoal">{c.property}</p><span className="text-[10px] font-bold uppercase text-gray-500">{CLAIM_STATUS[c.status]}</span></div>
          <p className="text-[11px] text-gray-500">{c.choice === "refund" ? "Refund requested" : `Move to ${c.new_check_in ? claimDay(c.new_check_in) : ""}`} · booked {claimDay(c.check_in)} · paid {formatNaira(c.paid_amount)}{c.covered ? ` · covered by: ${c.event}` : ""}</p>
          {c.status === "awaiting_host" && <p className="text-[11px] text-gray-500 mt-0.5">The venue has until {c.host_deadline ? new Date(c.host_deadline).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "soon"} to reply. {c.covered ? "If they do not, your request goes through with no costs to you." : "If they do not, CHS decides."}</p>}
          {c.status === "awaiting_guest" && (
            <div className="mt-1.5 bg-chs-amber-light rounded-lg p-2 space-y-1.5">
              <p className="text-[11px]">The venue agreed to refund you but asks to keep <b>{formatNaira(c.host_costs)}</b> for costs already incurred{c.host_note ? `: “${c.host_note}”` : ""}. You would get <b>{formatNaira(c.paid_amount - c.host_costs)}</b> back, with CHS&apos;s fee returned in full.</p>
              <div className="flex gap-2">
                <button onClick={() => act(supabase.rpc("guest_answer_claim", { p_claim: c.id, p_accept: true }))} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold">Accept</button>
                <button onClick={() => act(supabase.rpc("guest_answer_claim", { p_claim: c.id, p_accept: false }))} className="px-3 py-1 rounded-full border text-[11px]">Ask CHS to review</button>
              </div>
            </div>
          )}
          {c.status === "rejected" && (
            <div className="mt-1.5 space-y-1">
              {c.admin_note && <p className="text-[11px] italic text-gray-600">CHS: {c.admin_note}</p>}
              <p className="text-[11px] text-gray-500">The normal cancellation terms still apply to this booking.</p>
            </div>
          )}
          {c.status === "completed" && <p className="text-xs font-semibold text-green-700 mt-1">{c.outcome === "rescheduled" ? "Your booking was moved. Nothing more to pay." : `Refunded ${formatNaira(c.refund_amount || 0)} to your wallet${c.venue_keeps ? `; the venue kept ${formatNaira(c.venue_keeps)} for its costs` : ""}.`}</p>}
          {["awaiting_host", "awaiting_guest", "admin_review"].includes(c.status) && (
            <div className="flex gap-3 mt-1.5">
              {c.status === "awaiting_host" && <button onClick={() => { const n = window.prompt("Why should CHS step in now? (optional)") ?? ""; act(supabase.rpc("guest_escalate_claim", { p_claim: c.id, p_note: n })); }} className="text-[10px] underline text-gray-600">Ask CHS to step in</button>}
              <button onClick={() => act(supabase.rpc("guest_withdraw_claim", { p_claim: c.id }))} className="text-[10px] underline text-gray-500">Withdraw this request</button>
            </div>
          )}
        </div>
      ))}
      {rows.length > 0 && <p className="text-xs font-bold text-chs-charcoal pt-1">Cancelled bookings</p>}
      {rows.map((b) => {
        const p = embeddedOne(b.properties);
        const refunded = Number(b.cancellation_refund_amount || 0);
        return (
          <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex justify-between gap-2">
              <p className="text-sm font-bold text-chs-charcoal">{p?.title || "Property"}</p>
              <span className="text-[10px] font-bold uppercase text-gray-500">{b.status}</span>
            </div>
            <p className="text-[11px] text-gray-500">{day(b.check_in)} → {day(b.check_out)} · Booking {formatNaira(b.total_price)}</p>
            <p className={`text-xs font-semibold mt-1 ${refunded > 0 ? "text-green-700" : "text-gray-500"}`}>
              {refunded > 0 ? `Refunded to your wallet: ${formatNaira(refunded)}` : b.payment_status === "refunded" ? "Refunded to your wallet" : "Nothing had been charged or nothing is refundable under the cancellation terms."}
            </p>
            {b.host_decision_note && <p className="text-[11px] italic text-gray-500 mt-0.5">{b.host_decision_note}</p>}
            {sent === b.id ? <p className="text-[10px] text-green-700 font-semibold mt-2">✓ Sent. CHS will review it.</p>
              : open === b.id ? (
                <div className="mt-2 bg-gray-50 rounded-lg p-2">
                  <RaiseDisputeForm session={session!} shortletBookingId={b.id} againstUserId={p?.owner_id || null} onSuccess={() => { setSent(b.id); setOpen(null); }} onCancel={() => setOpen(null)} />
                </div>
              ) : <button onClick={() => setOpen(b.id)} className="text-[10px] text-chs-red underline mt-2">Question this refund or ask CHS to review it</button>}
          </div>
        );
      })}
      <p className="text-xs font-bold text-chs-charcoal pt-2">Refund payments received</p>
      <RefundsFeed />
    </div>
  );
}

function RefundsFeed() {
  return <TransactionsPanel compact limit={60} />;
}
