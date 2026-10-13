"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { Claim, CLAIM_STATUS, claimDay } from "@/components/ClaimTypes";

// The venue's side of a no-fault cancellation or date move: agree, claim real costs (capped), or disagree.
function ClaimCard({ c, onChanged }: { c: Claim; onChanged: () => void }) {
  const [costs, setCosts] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reply(action: "accept" | "contest") {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("host_reply_claim", { p_claim: c.id, p_action: action, p_costs: Number(costs) || 0, p_note: note.trim() || null });
    setBusy(false);
    if (error) setErr(error.message); else onChanged();
  }
  const until = c.host_deadline ? new Date(c.host_deadline).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className={`bg-white rounded-xl border p-3 ${c.status === "awaiting_host" ? "border-chs-red" : "border-gray-200"}`}>
      <div className="flex justify-between gap-2">
        <p className="text-sm font-bold text-chs-charcoal">{c.property}</p>
        <span className="text-[10px] font-bold uppercase text-gray-500">{CLAIM_STATUS[c.status]}</span>
      </div>
      <p className="text-[11px] text-gray-500">{c.guest} · booked {claimDay(c.check_in)} → {claimDay(c.check_out)} · paid {formatNaira(c.paid_amount)}</p>
      <p className="text-xs mt-1"><span className="font-semibold">{c.choice === "refund" ? "Wants to cancel and be refunded" : `Wants to move to ${c.new_check_in ? claimDay(c.new_check_in) : ""}`}</span>{c.covered ? ` · CHS declared: ${c.event}` : " · not under a declared disruption"}</p>
      <p className="text-[11px] italic text-gray-600">“{c.reason}”</p>
      {c.evidence_url && <a href={c.evidence_url} target="_blank" rel="noreferrer" className="text-[11px] underline">Evidence</a>}
      {c.status === "awaiting_host" && (
        <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
          <p className="text-[11px] text-gray-500">Reply by {until || "the deadline"}. {c.covered ? "If you do not reply, the guest is refunded in full or moved, with no costs to you." : "If you do not reply, CHS decides."}</p>
          {c.choice === "refund" && (
            <>
              <input value={costs} onChange={(e) => setCosts(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder={`Costs you have really incurred (₦, max ${formatNaira(c.cap)}; leave empty for none)`} className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
              <p className="text-[10px] text-gray-500">You keep these with no CHS commission. The guest gets everything else back, including CHS&apos;s fee.</p>
            </>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.choice === "refund" ? "What the costs were, or why you disagree" : "Note (optional); needed only if you disagree"} className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => reply("accept")} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold">{c.choice === "refund" ? "Agree to refund" : "Agree to the new date"}</button>
            <button disabled={busy} onClick={() => reply("contest")} className="px-3 py-1 rounded-full border border-red-300 text-red-600 text-[11px]">I disagree; ask CHS</button>
          </div>
        </div>
      )}
      {c.status === "awaiting_guest" && <p className="text-[11px] text-gray-500 mt-1">You asked to keep {formatNaira(c.host_costs)}. Waiting for the guest to accept.</p>}
      {c.status === "admin_review" && <p className="text-[11px] text-gray-500 mt-1">CHS is reviewing this and will decide.</p>}
      {c.status === "completed" && <p className="text-[11px] text-green-700 mt-1">{c.outcome === "rescheduled" ? "Moved to the new date." : `Refunded ${formatNaira(c.refund_amount || 0)}; you received ${formatNaira(c.venue_keeps || 0)} for costs.`}</p>}
      {err && <p className="text-[11px] text-red-600 mt-1">{err}</p>}
    </div>
  );
}

export default function HostClaimsPanel({ claims, onChanged }: { claims: Claim[]; onChanged: () => void }) {
  const open = claims.filter((c) => ["awaiting_host", "awaiting_guest", "admin_review"].includes(c.status));
  const closed = claims.filter((c) => !open.includes(c));
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-500">When something outside both sides&apos; control stops a booking (a curfew, flood, government order, bereavement), the guest may ask to move the date or be refunded. You may keep only costs you have really incurred, up to a limit, with no CHS commission. A booking someone else has already paid for is never moved to make room.</p>
      {claims.length === 0 && <p className="text-xs text-gray-400 py-6 text-center">No refund or date-move requests.</p>}
      {open.map((c) => <ClaimCard key={c.id + c.status} c={c} onChanged={onChanged} />)}
      {closed.length > 0 && <p className="text-xs font-bold text-chs-charcoal pt-2">Earlier</p>}
      {closed.map((c) => <ClaimCard key={c.id + c.status} c={c} onChanged={onChanged} />)}
    </div>
  );
}
