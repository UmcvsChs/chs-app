"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime } from "@/lib/format";
import { getFreshDocumentUrl } from "@/lib/storage";

// CHS's view of every Mortgage (Rent to Own) agreement, newest first. Nothing
// ever drops out of this list: a request moves through its stages and stays
// visible, so CHS is never cut out of a transaction.

interface Handover {
  status: string; recipient_name: string; delivery_address: string; delivery_phone: string; method: string; max_days: number; deadline: string; overdue: boolean;
  sent_at: string | null; sent_method: string | null; tracking: string | null; proof_note: string | null; proof_url: string | null; confirmed_at: string | null; confirmed_by?: string | null; requested_at?: string | null;
}
interface Row {
  id: string; ref: string; status: string; needs_action: boolean; property_title: string; property_ref: string; location: string | null;
  total_price: number; monthly_amount: number; total_paid: number; ownership_pct: number; payments: number | null; payments_made: number; last_payment_at: string | null;
  buyer_name: string; buyer_phone: string; applicant_occupation: string | null; applicant_source_of_funds: string | null; applicant_address: string | null; buyer_id_verified: boolean;
  owner_name: string; owner_phone: string; requested_at: string; owner_decision_at: string | null; owner_decision_note: string | null;
  competing_requests: number; final_held_amount: number; handover: Handover | null; completed_at?: string | null;
}

const STAGE: Record<string, { label: string; tone: string }> = {
  awaiting_admin_relay: { label: "1. New request: relay it to the owner", tone: "bg-chs-amber text-chs-charcoal" },
  requested: { label: "With the owner, waiting for their answer", tone: "bg-gray-200 text-gray-700" },
  owner_approved: { label: "Owner APPROVED: confirm to the buyer", tone: "bg-green-600 text-white" },
  owner_declined: { label: "Owner DECLINED: tell the buyer", tone: "bg-chs-red text-white" },
  active: { label: "Active: buyer is paying", tone: "bg-blue-100 text-blue-800" },
  awaiting_handover: { label: "Paid in full: final payment held until documents are handed over", tone: "bg-chs-charcoal text-white" },
  completed: { label: "Completed", tone: "bg-green-100 text-green-800" },
  declined: { label: "Declined / rejected", tone: "bg-gray-100 text-gray-500" },
  cancelled: { label: "Cancelled", tone: "bg-gray-100 text-gray-500" },
  defaulted: { label: "Defaulted", tone: "bg-gray-100 text-gray-500" },
};

interface Submission { id: string; status: string; note: string | null; review_note: string | null; created_at: string; reviewed_at?: string | null; files: { name: string; url: string }[] }
interface Pending { id: string; reference: string; amount: number; net_amount: number; paid_at: string; property_title: string; buyer_name: string; owner_name: string; agreement_ref: string }

export default function AdminRtoPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"action" | "all">("all");
  const [pending, setPending] = useState<Pending[]>([]);
  const [subs, setSubs] = useState<Record<string, Submission[]>>({});
  const [isSuper, setIsSuper] = useState(false);
  const [autoRelease, setAutoRelease] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_rto_admin_queue");
    setRows(Array.isArray(data) ? (data as Row[]) : []);
    const { data: pend } = await supabase.rpc("get_rto_pending_payments");
    setPending(Array.isArray(pend) ? (pend as Pending[]) : []);
    const list = Array.isArray(data) ? (data as Row[]) : [];
    const sb: Record<string, Submission[]> = {};
    await Promise.all(list.filter((r) => ["active", "awaiting_handover", "completed"].includes(r.status)).map(async (r) => {
      const { data: x } = await supabase.rpc("get_rto_submissions", { p_agreement_id: r.id });
      if (Array.isArray(x) && x.length) sb[r.id] = x as Submission[];
    }));
    setSubs(sb);
    const { data: on } = await supabase.rpc("rto_auto_release_on");
    setAutoRelease(on === true);
    const { data: au } = await supabase.auth.getUser();
    if (au.user) {
      const { data: me } = await supabase.from("profiles").select("is_super_admin").eq("id", au.user.id).single();
      setIsSuper(!!(me as { is_super_admin?: boolean } | null)?.is_super_admin);
    }
  }, []);
  async function openFile(url: string) {
    const fresh = await getFreshDocumentUrl(url);
    if (fresh) window.open(fresh, "_blank"); else setErr("Could not open that file.");
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function run(id: string, call: PromiseLike<{ error: { message: string } | null }>) {
    setBusy(id); setErr(null);
    const { error } = await call;
    setBusy(null);
    if (error) { setErr(error.message); return; }
    await load();
    onChanged?.();
  }
  const note = (id: string) => (notes[id] || "").trim();

  const shown = rows.filter((r) => (filter === "all" ? true : r.needs_action));

  return (
    <div>
      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 mb-3">
        🏠 Every Mortgage (Rent to Own) agreement, newest first. Every request, every owner answer and the final payment go through CHS. The owner never sees the buyer&apos;s name in full or phone number, and the buyer never deals with the owner directly. Nothing leaves this list.
      </p>
      <div className={`rounded-xl border-2 p-3 mb-3 ${autoRelease ? "border-chs-red bg-chs-amber-light" : "border-gray-100 bg-white"}`}>
        <label className="flex items-start gap-2 text-xs text-chs-charcoal">
          <input type="checkbox" checked={autoRelease} disabled={!isSuper || busy === "auto"} className="mt-0.5"
            onChange={(e) => {
              const on = e.target.checked;
              if (on && !window.confirm("Switch ON auto release? From now on, the moment a buyer confirms they received their documents (after the owner has sent them), the held final payment goes to the owner's wallet without any admin clicking. Use this only for busy periods.")) return;
              run("auto", supabase.rpc("admin_set_rto_auto_release", { p_on: on }));
            }} />
          <span><b>Auto release of final mortgage payments</b> {autoRelease ? <span className="text-chs-red font-bold">· ON</span> : <span className="text-gray-500">· OFF (manual)</span>}<br />
            <span className="text-[10px] text-gray-500">When this box is not ticked, every final payment stays held until a super admin releases it here. Tick it only in a busy period; untick it afterwards.{!isSuper ? " Only a super admin can change this." : ""}</span></span>
        </label>
      </div>
      <div className="flex gap-2 mb-3">
        {([["all", "All agreements"], ["action", "Needs action"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === k ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"}`}>
            {l}{k === "action" ? ` (${rows.filter((r) => r.needs_action).length})` : ` (${rows.length})`}
          </button>
        ))}
      </div>
      {err && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mb-3">{err}</p>}
      {pending.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-chs-amber p-3 mb-3">
          <div className="flex justify-between items-center gap-2 mb-2">
            <p className="text-sm font-bold text-chs-charcoal">💰 Payments to release ({pending.length})</p>
            <button onClick={() => run("all", supabase.rpc("admin_release_all_rto_payments"))} disabled={busy === "all"} className="px-3 py-1.5 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">Release all</button>
          </div>
          <p className="text-[10px] text-gray-500 mb-2">Every mortgage installment reaches CHS first. Each one below is sitting with CHS and has not yet reached the owner&apos;s wallet.</p>
          {pending.map((p) => (
            <div key={p.id} className="border-t border-gray-100 py-2 flex justify-between items-center gap-2">
              <div className="text-[11px] text-gray-700">
                <p className="font-semibold text-chs-charcoal">{formatNaira(p.net_amount)} to {p.owner_name} <span className="font-normal text-gray-500">(paid {formatNaira(p.amount)} before commission)</span></p>
                <p>{p.property_title} · from {p.buyer_name} · {p.agreement_ref} · {p.reference} · {formatDateTime(p.paid_at)}</p>
              </div>
              <button onClick={() => run(p.id, supabase.rpc("admin_release_rto_payment", { p_payment_id: p.id, p_note: null }))} disabled={busy === p.id} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50 whitespace-nowrap">Release to owner</button>
            </div>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">{filter === "action" ? "✓ Nothing is waiting for CHS." : "No agreements yet."}</p>
      ) : shown.map((r) => {
        const h = r.handover;
        const stage = r.status === "awaiting_handover" && h && h.status === "requested"
          ? { label: "Buyer has asked for the documents: waiting for the owner to upload and send them", tone: "bg-amber-100 text-amber-800" }
          : r.status === "awaiting_handover" && h && h.status === "confirmed"
            ? { label: "Buyer CONFIRMED receipt: final payment waiting for your release", tone: "bg-green-600 text-white" }
          : r.status === "awaiting_handover" && h && h.status === "sent"
            ? { label: "Owner says documents sent: confirm with the buyer, then release", tone: "bg-green-600 text-white" }
            : (STAGE[r.status] || { label: r.status, tone: "bg-gray-100 text-gray-600" });
        return (
          <div key={r.id} className={`bg-white rounded-xl border-2 p-3 mb-3 ${r.needs_action ? "border-chs-amber" : "border-gray-100"}`}>
            <div className="flex justify-between items-start gap-2">
              <p className="text-sm font-semibold text-chs-charcoal">{r.property_title}</p>
              <span className="text-[9px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">{r.ref}</span>
            </div>
            <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${stage.tone}`}>{stage.label}</span>
            <p className="text-[11px] text-gray-500 mt-1">{r.property_ref} · {r.location} · requested {formatDateTime(r.requested_at)}</p>
            <p className="text-xs font-bold text-chs-charcoal mt-1">{formatNaira(r.monthly_amount)}/month toward {formatNaira(r.total_price)} <span className="font-normal text-gray-500">({r.payments ?? "?"} payments)</span></p>
            {(r.payments_made > 0 || r.total_paid > 0) && (
              <p className="text-[11px] text-gray-600">Paid {formatNaira(r.total_paid)} in {r.payments_made} payment{r.payments_made !== 1 ? "s" : ""} · ownership {Number(r.ownership_pct).toFixed(2)}%{r.last_payment_at ? ` · last ${formatDateTime(r.last_payment_at)}` : ""}</p>
            )}
            <p className="text-[11px] text-gray-600 mt-1">Buyer: <b>{r.buyer_name}</b> · {r.buyer_phone} {r.buyer_id_verified ? <span className="text-green-700">· ID and liveness verified ✓</span> : <span className="text-chs-red">· not fully verified</span>}</p>
            {(r.applicant_occupation || r.applicant_source_of_funds || r.applicant_address) && (
              <p className="text-[11px] text-gray-500">{[r.applicant_occupation, r.applicant_source_of_funds && `funds: ${r.applicant_source_of_funds}`, r.applicant_address].filter(Boolean).join(" · ")}</p>
            )}
            <p className="text-[11px] text-gray-600">Owner: <b>{r.owner_name}</b> · {r.owner_phone}</p>
            {r.owner_decision_at && <p className="text-[11px] text-gray-600">Owner answered {formatDateTime(r.owner_decision_at)}{r.owner_decision_note ? `: “${r.owner_decision_note}”` : ""}</p>}
            {r.competing_requests > 0 && <p className="text-[11px] text-chs-red mt-1">⚠ {r.competing_requests} other request(s) are also pending on this property. Starting one will decline the rest.</p>}

            {(r.status === "awaiting_admin_relay" || r.status === "owner_approved" || r.status === "owner_declined" || (r.status === "awaiting_handover" && !(h && (h.status === "sent" || h.status === "confirmed")))) && (
              <input type="text" value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} maxLength={300}
                placeholder={r.status === "awaiting_admin_relay" ? "Note to the owner / reason to reject (required to reject)" : r.status === "awaiting_handover" ? "How you verified the handover (required to release without proof)" : "Optional note"}
                className="w-full mt-2 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
            )}

            {r.status === "awaiting_admin_relay" && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => run(r.id, supabase.rpc("admin_relay_rent_to_own", { p_agreement_id: r.id, p_note: note(r.id) || null }))} disabled={busy === r.id} className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">Relay to the owner</button>
                <button onClick={() => { if (note(r.id).length < 5) { setErr("Please give the buyer a reason for rejecting (a short sentence)."); return; } run(r.id, supabase.rpc("admin_reject_rent_to_own", { p_agreement_id: r.id, p_reason: note(r.id) })); }} disabled={busy === r.id} className="flex-1 py-2 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold disabled:opacity-50">Reject</button>
              </div>
            )}
            {(r.status === "owner_approved" || r.status === "owner_declined") && (
              <button onClick={() => run(r.id, supabase.rpc("admin_relay_rto_decision", { p_agreement_id: r.id, p_note: note(r.id) || null }))} disabled={busy === r.id}
                className="mt-2 w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                {r.status === "owner_approved" ? "Confirm to the buyer and start payments" : "Tell the buyer the owner declined"}
              </button>
            )}

            {(subs[r.id] || []).map((sb) => (
              <div key={sb.id} className="mt-2 bg-gray-50 rounded-lg p-2.5 text-[11px] text-gray-700">
                <p className="font-bold text-chs-charcoal">📄 Documents from the owner ({sb.status === "approved" ? "approved" : sb.status === "changes_requested" ? "changes requested" : "waiting for your check"}) · {formatDateTime(sb.created_at)}</p>
                <div className="flex flex-wrap gap-1.5 my-1">
                  {sb.files.map((f, i) => (<button key={i} type="button" onClick={() => openFile(f.url)} className="px-2 py-1 rounded-full bg-white border border-gray-200 text-[10px] underline">{f.name}</button>))}
                </div>
                {sb.status === "submitted" && (
                  <>
                    <input type="text" value={notes[sb.id] || ""} onChange={(e) => setNotes({ ...notes, [sb.id]: e.target.value })} maxLength={300} placeholder="What needs to change (required to ask for changes)" className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
                    <div className="flex gap-2 mt-1.5">
                      <button onClick={() => run(sb.id, supabase.rpc("admin_review_rto_documents", { p_submission_id: sb.id, p_approve: true, p_note: note(sb.id) || null }))} disabled={busy === sb.id} className="flex-1 py-1.5 rounded-full bg-green-600 text-white text-[11px] font-semibold disabled:opacity-50">Approve</button>
                      <button onClick={() => { if (note(sb.id).length < 5) { setErr("Please say what needs to change."); return; } run(sb.id, supabase.rpc("admin_review_rto_documents", { p_submission_id: sb.id, p_approve: false, p_note: note(sb.id) })); }} disabled={busy === sb.id} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-700 text-[11px] font-semibold disabled:opacity-50">Ask for changes</button>
                    </div>
                  </>
                )}
                {sb.review_note && <p className="text-gray-500 mt-1">Your note: {sb.review_note}</p>}
              </div>
            ))}

            {(h || r.completed_at) && (
              <div className="mt-2 border-l-2 border-gray-200 pl-2.5 text-[10px] text-gray-600 space-y-0.5">
                <p className="font-bold text-chs-charcoal text-[10px]">🕒 Handover timeline (Nigerian time, to the second)</p>
                {h?.requested_at && <p>Buyer asked for the documents: <b>{formatDateTime(h.requested_at)}</b></p>}
                {(subs[r.id] || []).slice().reverse().map((sb) => (
                  <p key={sb.id}>Owner uploaded documents: <b>{formatDateTime(sb.created_at)}</b>{sb.reviewed_at ? <> · CHS {sb.status === "approved" ? "approved" : "reviewed"}: <b>{formatDateTime(sb.reviewed_at)}</b></> : " · not yet reviewed"}</p>
                ))}
                {h?.sent_at && <p>Owner marked the hard copy as sent: <b>{formatDateTime(h.sent_at)}</b></p>}
                {h?.deadline && <p>Delivery deadline: <b>{formatDateTime(h.deadline)}</b></p>}
                {h?.confirmed_at && <p>{h.confirmed_by === "buyer" ? "Buyer confirmed receipt" : "Handover confirmed (" + (h.confirmed_by || "CHS") + ")"}: <b>{formatDateTime(h.confirmed_at)}</b> · CHS was alerted at the same moment</p>}
                {r.completed_at && <p>Final payment released: <b>{formatDateTime(r.completed_at)}</b></p>}
              </div>
            )}
            {r.status === "awaiting_handover" && (
              <div className="mt-2 bg-gray-50 rounded-lg p-2.5 text-[11px] text-gray-700 space-y-0.5">
                <p className="font-bold text-chs-charcoal">🔒 {formatNaira(r.final_held_amount)} held for the owner</p>
                {!h && <p>The buyer has not asked for the documents yet.</p>}
                {h && (
                  <>
                    <p>Deliver to {h.recipient_name}, {h.delivery_address} · buyer phone <b>{h.delivery_phone}</b> · by {formatDateTime(h.deadline)}{h.overdue ? " · OVERDUE" : ""}</p>
                    {h.status === "requested" && <p className="text-amber-700">Waiting for the owner to send and show proof.</p>}
                    {h.status === "confirmed" && <p className="text-green-700 font-semibold">✓ The buyer confirmed on {h.confirmed_at ? formatDateTime(h.confirmed_at) : "—"} that the documents arrived. The money stays held until you release it.</p>}
                    {h.status === "sent" && <p className="text-green-700">Owner says sent{h.sent_method ? ` by ${h.sent_method}` : ""}{h.tracking ? `, tracking ${h.tracking}` : ""}. {h.proof_note ? `“${h.proof_note}”` : ""} {h.proof_url && <button type="button" onClick={() => openFile(h.proof_url as string)} className="underline">View receipt</button>} Phone the buyer to confirm, then release.</p>}
                  </>
                )}
                {isSuper ? (
                  <button onClick={() => { if (window.confirm(`Release ${formatNaira(r.final_held_amount)} to ${r.owner_name}? This moves real money into their wallet.`)) run(r.id, supabase.rpc("admin_release_rto_final", { p_agreement_id: r.id, p_note: note(r.id) || null })); }} disabled={busy === r.id}
                    className="mt-1.5 w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">Release the final payment to the owner</button>
                ) : (
                  <p className="mt-1.5 text-[11px] text-chs-red">Only a super admin can release the final payment.</p>
                )}
              </div>
            )}
            {r.status === "completed" && h && <p className="text-[11px] text-green-700 mt-1">Handover confirmed{h.confirmed_at ? ` on ${formatDateTime(h.confirmed_at)}` : ""}.</p>}
          </div>
        );
      })}
    </div>
  );
}
