"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { CLAIM_TYPE_LABEL, REMEDY_LABEL, FAULT_LABEL, STATUS_LABEL, FLAG_LABEL, signedUrls, uploadClaimPhotos, fmtDT, timeLeft } from "@/lib/claims";
import ClaimPhotoPicker from "@/components/ClaimPhotoPicker";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="bg-white rounded-xl border border-gray-100 p-4 mb-3 print:border-0 print:p-0"><h2 className="text-xs font-bold text-chs-charcoal mb-2">{title}</h2>{children}</section>;
}

export default function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Json>(null);
  const [err, setErr] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [uid, setUid] = useState<string>("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_claim", { p_id: id });
    if (error) { setErr(error.message); return; }
    setD(data);
    const paths: string[] = [...(data.evidence || []).filter((e: Json) => e.path).map((e: Json) => e.path), ...((data.shipment?.packing_photos as string[]) || [])];
    setUrls(await signedUrls(paths));
  }, [id]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id || ""));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function call(fn: string, args: Json, ok?: string) {
    setBusy(true); setErr(null); setMsg(null);
    const { data, error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErr(error.message); return null; }
    if (ok) setMsg(ok);
    await load();
    return data;
  }

  if (err && !d) return <main className="max-w-xl mx-auto p-4"><p className="text-sm text-chs-red">{err}</p><Link href="/claims" className="text-xs underline">← My claims</Link></main>;
  if (!d) return <main className="max-w-xl mx-auto p-4 text-sm text-gray-500">Loading…</main>;

  const c = d.claim, o = d.order, role: "buyer" | "seller" | "admin" = d.role;
  const st = STATUS_LABEL[c.status] || STATUS_LABEL.open;
  const closed = c.status === "decided" || c.status === "withdrawn";
  const photos = (d.evidence as Json[]).filter((e) => e.path);
  const notes = (d.evidence as Json[]).filter((e) => !e.path);

  return (
    <main className="max-w-xl mx-auto p-4 pb-24">
      <div className="print:hidden mb-3 flex items-center justify-between">
        <Link href={role === "admin" ? "/admin?tab=claims" : "/claims"} className="text-xs text-gray-500">← {role === "admin" ? "Claims (admin)" : "My claims"}</Link>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
      </div>
      <h1 className="text-lg font-bold text-chs-charcoal">{c.reference}</h1>
      <p className="text-xs text-gray-500 mb-3">{o.product} · order {o.reference} · opened {fmtDT(c.opened_at)}</p>
      {c.flagged && <p className="text-[11px] font-semibold bg-amber-50 text-amber-800 rounded-lg px-3 py-2 mb-3">{FLAG_LABEL[c.flagged] || c.flagged}.</p>}
      {c.overdue && role === "admin" && <p className="text-[11px] font-semibold bg-red-50 text-chs-red rounded-lg px-3 py-2 mb-3">⏰ Overdue: the decision was promised by {fmtDT(c.chs_due_at)}.</p>}
      {err && <p className="text-xs text-chs-red font-semibold mb-2">{err}</p>}
      {msg && <p className="text-xs text-green-700 font-semibold mb-2">{msg}</p>}

      <Box title="What was reported">
        <p className="text-sm text-chs-charcoal"><b>{CLAIM_TYPE_LABEL[c.claim_type]}</b> · {c.units_affected} of {o.original_quantity} unit(s){c.at_door ? " · reported at the door" : ""}</p>
        <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{c.description}</p>
        <p className="text-[11px] text-gray-500 mt-1">Buyer asked for: <b>{REMEDY_LABEL[c.remedy_wanted]}</b> · Buyer: {d.buyer.name}{d.buyer.phone ? ` (${d.buyer.phone})` : ""} · Seller: {d.seller.name}{d.seller.phone ? ` (${d.seller.phone})` : ""}</p>
        <div className="mt-2 text-[11px] bg-gray-50 rounded-lg px-3 py-2 text-gray-700">
          Item value {formatNaira(o.original_amount)}{o.refunded_amount > 0 ? ` · refunded so far ${formatNaira(o.refunded_amount)}` : ""} · payment is <b>{o.payment_status === "held_escrow" ? "held by CHS" : o.payment_status === "released" ? "already released to the seller" : o.payment_status}</b>
        </div>
      </Box>

      {(photos.length > 0 || notes.length > 0) && (
        <Box title="Evidence">
          <div className="flex flex-wrap gap-2">
            {photos.map((e) => urls[e.path] ? (
              <a key={e.id} href={urls[e.path]} target="_blank" rel="noreferrer" className="block w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls[e.path]} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                <span className="text-[9px] text-gray-500">{e.role === "seller" ? "Seller" : "Buyer"}</span>
              </a>
            ) : <span key={e.id} className="w-20 h-20 rounded-lg bg-gray-100 text-[9px] text-gray-400 flex items-center justify-center">loading</span>)}
          </div>
          {notes.map((e) => <p key={e.id} className="mt-2 text-[11px] bg-blue-50 text-blue-900 rounded-lg px-3 py-2 whitespace-pre-wrap"><b>{e.role === "rider" ? "Rider / courier statement" : e.role}:</b> {e.note}</p>)}
        </Box>
      )}

      {(d.shipment.packing_photos?.length > 0 || d.shipment.dispatch_method) && (
        <Box title="How it was sent">
          <p className="text-xs text-gray-700">
            {d.shipment.dispatch_method ? `Method: ${d.shipment.dispatch_method.replace("_", " ")}` : "Method not recorded"}
            {d.shipment.rider_name ? ` · Rider ${d.shipment.rider_name}${d.shipment.rider_phone ? " " + d.shipment.rider_phone : ""}${d.shipment.vehicle_plate ? " (" + d.shipment.vehicle_plate + ")" : ""}` : ""}
            {d.shipment.carrier ? ` · ${d.shipment.carrier} ${d.shipment.tracking_no || ""}` : ""}
          </p>
          {d.shipment.packed_at && <p className="text-[11px] text-gray-500">Packed {fmtDT(d.shipment.packed_at)}{d.shipment.dispatched_at ? ` · handed over ${fmtDT(d.shipment.dispatched_at)}` : ""}{d.shipment.delivered_at ? ` · delivered ${fmtDT(d.shipment.delivered_at)}` : ""}</p>}
          {d.shipment.packing_photos?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">{(d.shipment.packing_photos as string[]).map((p) => urls[p] ? <a key={p} href={urls[p]} target="_blank" rel="noreferrer"><img src={urls[p]} alt="packing" className="w-16 h-16 object-cover rounded-lg border border-gray-200" /></a> : null)}<span className="text-[9px] text-gray-500 self-end">Packing photos by the seller</span></div>
          )}
        </Box>
      )}

      {c.seller_response && (
        <Box title="Seller's reply">
          <p className="text-sm font-semibold text-chs-charcoal">{c.seller_response === "accept" ? "Accepted the report" : c.seller_response === "dispute" ? "Disputes the report" : c.offer_kind === "replacement" ? "Offers a replacement" : `Offers ${formatNaira(c.offer_amount)} back`}</p>
          {c.seller_note && <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{c.seller_note}</p>}
          {c.buyer_answer && <p className="text-[11px] text-gray-500 mt-1">Buyer {c.buyer_answer === "accept" ? "accepted" : "rejected"} the offer.</p>}
        </Box>
      )}

      {/* ---------------- actions ---------------- */}
      {!closed && role === "seller" && c.status === "open" && <SellerReply c={c} o={o} busy={busy} call={call} claimId={c.id} />}
      {!closed && role === "buyer" && c.status === "offer_made" && (
        <Box title="The seller made you an offer">
          <p className="text-xs text-gray-700 mb-2">{c.offer_kind === "replacement" ? "The seller will send you a replacement." : `The seller offers ${formatNaira(c.offer_amount)} back and you keep the goods.`} Reply {timeLeft(c.buyer_due_at) ? `(${timeLeft(c.buyer_due_at)})` : ""}. If you reject, CHS will decide.</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => call("buyer_answer_offer", { p_claim: c.id, p_accept: true }, "Thank you. You accepted the offer.")} className="flex-1 py-2 rounded-full bg-green-600 text-white text-xs font-semibold">Accept</button>
            <button disabled={busy} onClick={() => call("buyer_answer_offer", { p_claim: c.id, p_accept: false }, "You rejected the offer. CHS will decide.")} className="flex-1 py-2 rounded-full border border-gray-300 text-xs font-semibold text-gray-700">Reject</button>
          </div>
        </Box>
      )}
      {!closed && role === "seller" && c.status === "replacement_pending" && c.flagged !== "replacement_sent" && <ReplacementSent c={c} busy={busy} call={call} />}
      {!closed && role === "seller" && c.status === "replacement_pending" && c.flagged === "replacement_sent" && <CodeEntry title="Replacement handed over?" help="When the rider or you hand the replacement to the buyer, ask for their 6-digit replacement code and enter it here. This closes the case." button="Confirm handover" busy={busy} onSubmit={(code) => call("seller_confirm_replacement_code", { p_claim: c.id, p_code: code }, "Handover confirmed. The case is closed.")} />}
      {!closed && role === "buyer" && c.status === "replacement_pending" && d.replacement?.code && (
        <Box title="Your replacement code">
          <p className="text-2xl font-bold tracking-[0.3em] text-chs-charcoal">{d.replacement.code}</p>
          <p className="text-[11px] text-gray-600 mt-1">Check the replacement first. Give this code to the rider or seller only when you are happy with it.{d.replacement.rider ? ` Rider: ${d.replacement.rider} ${d.replacement.phone || ""}.` : ""}{d.replacement.method ? ` Sent by: ${String(d.replacement.method).replace("_", " ")}.` : ""}</p>
        </Box>
      )}
      {!closed && role === "buyer" && c.status === "return_pending" && (
        <Box title="Return the goods">
          <p className="text-xs text-gray-700 mb-2">CHS decided the goods must come back before you are refunded. Take them within 7 days{d.return.due_at ? ` (by ${fmtDT(d.return.due_at)})` : ""} to:</p>
          <p className="text-sm font-semibold text-chs-charcoal">{d.return.to === "seller" ? "The seller: " : "CHS collection centre: "}{d.return.destination}</p>
          <p className="text-[11px] text-gray-600 mt-2">Give this code to the person who receives them. They enter it to prove the goods were handed back:</p>
          <p className="text-2xl font-bold tracking-[0.3em] text-chs-charcoal mt-1">{d.return.code}</p>
        </Box>
      )}
      {!closed && c.status === "return_pending" && ((role === "seller" && d.return.to === "seller") || role === "admin") && (
        <CodeEntry title={role === "admin" ? "Goods received back (CHS centre)" : "Goods received back"} help="Enter the buyer's 6-digit return code and describe the condition of what you received." button="Confirm goods received" withCondition busy={busy} onSubmit={(code, cond) => call("claim_confirm_return_received", { p_claim: c.id, p_code: code, p_condition: cond }, "Return recorded. CHS will approve the refund.")} />
      )}
      {d.return?.received_at && c.status !== "return_received" && <p className="text-[11px] bg-green-50 text-green-800 rounded-lg px-3 py-2 mb-3">✓ Goods received back {fmtDT(d.return.received_at)}. Condition: {d.return.condition}</p>}
      {!closed && role === "buyer" && c.status === "replacement_pending" && c.flagged === "replacement_sent" && (
        <Box title="Your replacement">
          <p className="text-xs text-gray-700 mb-2">The seller says the replacement was sent. Check it when it arrives, then confirm.</p>
          <button disabled={busy} onClick={() => call("buyer_confirm_replacement", { p_claim: c.id }, "Thank you. This case is closed.")} className="w-full py-2 rounded-full bg-green-600 text-white text-xs font-semibold">I received the replacement</button>
        </Box>
      )}
      {!closed && role !== "admin" && <AddEvidence c={c} uid={uid} busy={busy} setErr={setErr} call={call} role={role} />}
      {!closed && role === "seller" && <RiderLink c={c} links={d.rider_links} call={call} busy={busy} />}
      {!closed && role === "buyer" && ["open", "offer_made", "awaiting_chs"].includes(c.status) && (
        <button disabled={busy} onClick={() => { if (confirm("Withdraw this report?")) call("buyer_withdraw_claim", { p_claim: c.id }, "Report withdrawn."); }} className="text-[11px] text-gray-500 underline mb-3">Withdraw my report</button>
      )}
      {role === "admin" && !closed && <AdminDecision d={d} busy={busy} call={call} />}

      {c.status === "decided" && <Decision d={d} role={role} />}

      <Box title="History">
        <ol className="space-y-1.5">
          {(d.events as Json[]).map((e, i) => (
            <li key={i} className="text-[11px] text-gray-700"><span className="text-gray-400">{fmtDT(e.at)}</span> · <b>{e.role}</b> · {e.action.replace(/_/g, " ")}{e.note ? ` — ${e.note}` : ""}</li>
          ))}
        </ol>
      </Box>
    </main>
  );
}

function Decision({ d, role }: { d: Json; role: string }) {
  const c = d.claim, o = d.order;
  const remedy = c.remedy;
  return (
    <section className="bg-white rounded-xl border-2 border-chs-charcoal p-4 mb-3">
      <div className="flex justify-between items-start">
        <div><h2 className="text-sm font-bold text-chs-charcoal">CHS decision notice</h2><p className="text-[11px] text-gray-500">{c.reference} · decided {fmtDT(c.decided_at)}</p></div>
        <button onClick={() => window.print()} className="print:hidden text-[11px] px-3 py-1.5 rounded-full border border-gray-300 font-semibold">🖨️ Print / save PDF</button>
      </div>
      <p className="text-sm mt-2"><b>Outcome:</b> {remedy === "reject" ? "Claim not upheld" : remedy === "replacement" ? "Replacement" : "Refund to the buyer"}{c.fault ? ` · Fault: ${FAULT_LABEL[c.fault] || c.fault}` : ""}</p>
      {c.decision_note && <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{c.decision_note}</p>}
      {c.total_to_buyer > 0 && (
        <table className="w-full text-xs mt-3">
          <tbody>
            <tr><td className="py-0.5 text-gray-600">Goods refunded ({o.product})</td><td className="text-right">{formatNaira(c.goods_refund)}</td></tr>
            <tr><td className="py-0.5 text-gray-600">CHS buyer commission returned</td><td className="text-right">{formatNaira(c.buyer_commission_refund)}</td></tr>
            {c.delivery_refund > 0 && <tr><td className="py-0.5 text-gray-600">Delivery fee returned</td><td className="text-right">{formatNaira(c.delivery_refund)}</td></tr>}
            {c.fee_withheld > 0 && <tr><td className="py-0.5 text-gray-600">Bank processing fee kept</td><td className="text-right">− {formatNaira(c.fee_withheld)}</td></tr>}
            <tr className="border-t border-gray-200 font-bold"><td className="py-1">Paid to the buyer&apos;s wallet</td><td className="text-right">{formatNaira(c.total_to_buyer)}</td></tr>
            {role !== "buyer" && c.seller_clawback > 0 && <tr><td className="py-0.5 text-gray-600">Taken back from the seller</td><td className="text-right">{formatNaira(c.seller_clawback)}</td></tr>}
            {role === "admin" && c.fund_paid > 0 && <tr><td className="py-0.5 text-gray-600">Paid by the Delivery Protection Fund</td><td className="text-right">{formatNaira(c.fund_paid)}</td></tr>}
          </tbody>
        </table>
      )}
      {role === "admin" && d.recoveries?.length > 0 && <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-2">Seller still owes {formatNaira((d.recoveries as Json[]).reduce((a, r) => a + (r.amount - r.recovered), 0))} (not enough in their wallet). It is recorded and will be taken from future earnings.</p>}
      {role === "seller" && c.seller_clawback > 0 && <p className="text-[11px] text-gray-600 mt-2">If your wallet did not have enough, the rest is recorded and will be taken from your future earnings.</p>}
    </section>
  );
}

function SellerReply({ c, o, busy, call, claimId }: { c: Json; o: Json; busy: boolean; call: (fn: string, a: Json, ok?: string) => Promise<unknown>; claimId: string }) {
  const [mode, setMode] = useState<"accept" | "offer" | "dispute" | "">("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState("partial_refund");
  const [amt, setAmt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [localErr, setLocalErr] = useState<string | null>(null);
  async function send() {
    setLocalErr(null);
    try {
      if (files.length) {
        const { data: u } = await supabase.auth.getUser();
        const paths = await uploadClaimPhotos(files, u.user!.id, "claims");
        await supabase.rpc("claim_add_evidence", { p_claim: claimId, p_paths: paths, p_note: null });
      }
      await call("seller_respond_claim", { p_claim: claimId, p_response: mode, p_note: note, p_offer_kind: mode === "offer" ? kind : null, p_offer_amount: mode === "offer" && kind === "partial_refund" ? Number(amt) : null }, "Your reply was sent.");
    } catch (e) { setLocalErr((e as Error).message); }
  }
  return (
    <Box title={`Your reply (${timeLeft(c.seller_due_at)})`}>
      <p className="text-[11px] text-gray-600 mb-2">If you do not reply in time, CHS decides on the buyer&apos;s evidence. Item value {formatNaira(o.amount)}.</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {([["accept", "Accept"], ["offer", "Offer a fix"], ["dispute", "Dispute"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={`py-2 rounded-lg text-xs font-semibold border ${mode === k ? "bg-chs-charcoal text-white border-chs-charcoal" : "border-gray-300 text-gray-700"}`}>{l}</button>
        ))}
      </div>
      {mode === "accept" && <p className="text-[11px] text-gray-600 mb-2">You agree the goods had a problem. CHS will approve the refund. The refund is taken from this sale.</p>}
      {mode === "offer" && (
        <div className="space-y-2 mb-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"><option value="partial_refund">Give part of the money back (buyer keeps the goods)</option><option value="replacement">Send a replacement</option></select>
          {kind === "partial_refund" && <input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={`Amount in ₦ (less than ${o.amount})`} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />}
        </div>
      )}
      {mode && (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={mode === "dispute" ? "Explain why you disagree. Add photos: how it was packed, the goods before sending." : "Add a note for the buyer (optional)"} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2" />
          <p className="text-[11px] font-semibold text-gray-700 mb-1">Photos (optional, helpful if you dispute)</p>
          <ClaimPhotoPicker files={files} onChange={setFiles} />
          {localErr && <p className="text-xs text-chs-red mt-2">{localErr}</p>}
          <button disabled={busy || (mode === "dispute" && note.trim().length < 10) || (mode === "offer" && kind === "partial_refund" && !Number(amt))} onClick={send} className="mt-3 w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">{busy ? "Sending…" : "Send my reply"}</button>
        </>
      )}
    </Box>
  );
}

function CodeEntry({ title, help, button, busy, onSubmit, withCondition }: { title: string; help: string; button: string; busy: boolean; onSubmit: (code: string, cond: string) => void; withCondition?: boolean }) {
  const [code, setCode] = useState("");
  const [cond, setCond] = useState("");
  return (
    <Box title={title}>
      <p className="text-[11px] text-gray-600 mb-2">{help}</p>
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="w-40 px-3 py-2 rounded-lg border border-gray-200 text-sm tracking-widest mb-2 block" />
      {withCondition && <textarea value={cond} onChange={(e) => setCond(e.target.value)} rows={2} placeholder="Condition of the goods (e.g. 20 blocks, all broken, packed in a sack)" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2" />}
      <button disabled={busy || code.length !== 6 || (withCondition && cond.trim().length < 5)} onClick={() => onSubmit(code, cond)} className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">{button}</button>
    </Box>
  );
}

function ReplacementSent({ c, busy, call }: { c: Json; busy: boolean; call: (fn: string, a: Json, ok?: string) => Promise<unknown> }) {
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("own_rider");
  const [rider, setRider] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <Box title="Send the replacement">
      <p className="text-xs text-gray-700 mb-2">Send the replacement to the same address. Tell the buyer how it is travelling (rider name and phone, or courier and waybill).</p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Sent with rider Musa 0803…, arrives tomorrow" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2" />
      <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2"><option value="own_rider">My own rider or vehicle</option><option value="courier">A courier / park (bus)</option><option value="chs_centre">Via a CHS collection centre</option></select>
      <div className="grid grid-cols-2 gap-2 mb-2"><input value={rider} onChange={(e) => setRider(e.target.value)} placeholder="Rider / courier name" className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs" /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs" /></div>
      <p className="text-[10px] text-gray-500 mb-2">The buyer gets a replacement code. The case closes when the buyer confirms, or when you enter their code at handover.</p>
      <button disabled={busy || note.trim().length < 5} onClick={() => call("seller_mark_replacement_sent", { p_claim: c.id, p_note: note, p_method: method, p_rider: rider, p_phone: phone }, "The buyer has been told.")} className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">I have sent the replacement</button>
    </Box>
  );
}

function AddEvidence({ c, uid, busy, setErr, call, role }: { c: Json; uid: string; busy: boolean; setErr: (s: string | null) => void; call: (fn: string, a: Json, ok?: string) => Promise<unknown>; role: string }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [up, setUp] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="print:hidden text-[11px] font-semibold text-chs-red underline mb-3 block">＋ Add more photos or a note</button>;
  async function save() {
    setUp(true); setErr(null);
    try {
      const paths = files.length ? await uploadClaimPhotos(files, uid, "claims") : [];
      await call("claim_add_evidence", { p_claim: c.id, p_paths: paths, p_note: note || null }, "Added.");
      setOpen(false); setFiles([]); setNote("");
    } catch (e) { setErr((e as Error).message); }
    setUp(false);
  }
  return (
    <Box title={role === "seller" ? "Add your evidence" : "Add more evidence"}>
      <ClaimPhotoPicker files={files} onChange={setFiles} />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional)" className="mt-2 w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
      <div className="flex gap-2 mt-2"><button disabled={busy || up || (!files.length && note.trim().length < 3)} onClick={save} className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">{up ? "Uploading…" : "Save"}</button><button onClick={() => setOpen(false)} className="px-3 text-xs text-gray-500">Cancel</button></div>
    </Box>
  );
}

function RiderLink({ c, links, call, busy }: { c: Json; links: Json[]; call: (fn: string, a: Json, ok?: string) => Promise<unknown>; busy: boolean }) {
  const [copied, setCopied] = useState("");
  const base = typeof window !== "undefined" ? window.location.origin : "";
  async function make() { await call("claim_create_rider_link", { p_claim: c.id }, "Link created. Send it to your rider or courier."); }
  return (
    <Box title="Ask your rider or courier for a statement">
      <p className="text-[11px] text-gray-600 mb-2">If a rider or courier carried this order, send them a link. They answer five short questions on their phone. No login. It becomes part of the evidence.</p>
      {links.map((l) => {
        const u = `${base}/rider-statement/${l.token}`;
        return (
          <div key={l.id} className="mb-2 rounded-lg bg-gray-50 px-3 py-2">
            {l.used_at ? <p className="text-[11px] text-green-700 font-semibold">✓ {l.rider_name} sent a statement {fmtDT(l.used_at)}</p> : (
              <>
                <p className="text-[10px] text-gray-500 break-all">{u}</p>
                <div className="flex gap-3 mt-1">
                  <button onClick={() => { navigator.clipboard?.writeText(u); setCopied(l.id); }} className="text-[11px] font-semibold text-chs-red underline">{copied === l.id ? "Copied" : "Copy link"}</button>
                  <a href={`https://wa.me/?text=${encodeURIComponent("Please give a short statement about the parcel you carried: " + u)}`} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-green-700 underline">Send on WhatsApp</a>
                  <span className="text-[10px] text-gray-400">expires {fmtDT(l.expires_at)}</span>
                </div>
              </>
            )}
          </div>
        );
      })}
      <button disabled={busy} onClick={make} className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-gray-300">＋ Create a rider link</button>
    </Box>
  );
}

function AdminDecision({ d, busy, call }: { d: Json; busy: boolean; call: (fn: string, a: Json, ok?: string) => Promise<unknown> }) {
  const c = d.claim, o = d.order;
  const [fault, setFault] = useState(c.fault || "seller");
  const [remedy, setRemedy] = useState<string>(c.remedy_wanted === "replacement" ? "replacement" : c.seller_response === "offer" && c.offer_kind === "partial_refund" ? "partial" : "refund");
  const [goods, setGoods] = useState<string>(c.offer_amount && remedy === "partial" ? String(c.offer_amount) : "");
  const [note, setNote] = useState("");
  const [prev, setPrev] = useState<Json>(null);
  const [rn, setRn] = useState("");
  const [retTo, setRetTo] = useState("chs_centre");
  useEffect(() => {
    if (!["refund", "partial", "return_refund"].includes(remedy)) return;
    supabase.rpc("admin_claim_preview", { p_claim: c.id, p_fault: fault, p_goods: remedy === "partial" && goods ? Number(goods) : null }).then(({ data }) => setPrev(data));
  }, [c.id, fault, remedy, goods]);

  if (c.status === "awaiting_second") {
    const p = c.pending_decision || {};
    return (
      <Box title="Second approval needed">
        <p className="text-xs text-gray-700 mb-2">Proposed: fault <b>{FAULT_LABEL[p.fault] || p.fault}</b>, {p.remedy}{p.goods ? ` of ${formatNaira(p.goods)}` : ""}. Reason: {p.note}</p>
        {c.pending_by_me ? <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mb-2">You proposed this. A different admin must approve it.</p> : (
          <button disabled={busy} onClick={() => call("admin_second_approve_claim", { p_claim: c.id }, "Approved and refunded.")} className="w-full py-2.5 rounded-full bg-green-600 text-white text-xs font-semibold mb-2">Approve and refund</button>
        )}
        <button disabled={busy} onClick={() => call("admin_return_to_review", { p_claim: c.id }, "Sent back to review.")} className="text-[11px] underline text-gray-500">Send back to review</button>
      </Box>
    );
  }
  if (c.status === "return_pending") {
    return (
      <Box title="Waiting for the goods to be returned">
        <p className="text-xs text-gray-700 mb-2">The buyer returns the goods to {d.return.to === "seller" ? "the seller" : "a CHS collection centre"}: {d.return.destination}. Use the &quot;Goods received back&quot; box above when they arrive. If the receiver confirmed some other way, you may approve below.</p>
        <input value={rn} onChange={(e) => setRn(e.target.value)} placeholder="Note: who received, condition" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2" />
        <button disabled={busy} onClick={() => call("admin_confirm_claim_return", { p_claim: c.id, p_note: rn }, "Return confirmed.")} className="w-full py-2 rounded-full border border-chs-red text-chs-red text-xs font-semibold">Approve refund without a code entry</button>
      </Box>
    );
  }
  if (c.status === "return_received") {
    return (
      <Box title="Goods are back: inspect and approve the refund">
        <p className="text-xs text-gray-700 mb-1">Received {fmtDT(d.return.received_at)}. Condition recorded: <b>{d.return.condition}</b></p>
        <p className="text-[11px] text-gray-500 mb-2">Fault and amount are as decided earlier. Approving makes the refund (a second admin is asked above ₦500,000).</p>
        <input value={rn} onChange={(e) => setRn(e.target.value)} placeholder="Note: who received, condition" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2" />
        <button disabled={busy} onClick={() => call("admin_confirm_claim_return", { p_claim: c.id, p_note: rn }, "Return confirmed.")} className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold">Goods received back: make the refund</button>
      </Box>
    );
  }
  const rate = d.seller_claim_rate as number;
  return (
    <Box title="CHS decision">
      <div className="text-[11px] text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mb-3 space-y-0.5">
        <p>Seller claim rate (90 days): <b className={rate > 3 ? "text-chs-red" : ""}>{rate}%</b> · seller total claims {d.seller_claims_total} · this buyer&apos;s total claims {d.buyer_claims_total}</p>
        <p>Seller reply: <b>{c.seller_response || "none yet"}</b>{c.flagged ? ` · ${FLAG_LABEL[c.flagged]}` : ""} · Item value {formatNaira(o.amount)} · Seller already received {formatNaira(o.vendor_paid)}</p>
      </div>
      <label className="block text-[11px] font-semibold text-gray-700 mb-2">Who was at fault?
        <select value={fault} onChange={(e) => setFault(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-normal">
          {Object.entries(FAULT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="block text-[11px] font-semibold text-gray-700 mb-2">Outcome
        <select value={remedy} onChange={(e) => setRemedy(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-normal">
          <option value="refund">Refund the affected units</option><option value="partial">Partial refund (set amount)</option><option value="return_refund">Return the goods first, then refund</option><option value="replacement">Seller replaces the goods</option><option value="reject">Reject the claim</option>
        </select>
      </label>
      {remedy === "return_refund" && (
        <label className="block text-[11px] font-semibold text-gray-700 mb-2">Where does the buyer return the goods?
          <select value={retTo} onChange={(e) => setRetTo(e.target.value)} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-normal"><option value="chs_centre">CHS collection centre (CHS inspects)</option><option value="seller">Back to the seller</option></select>
        </label>
      )}
      {remedy === "partial" && <input type="number" value={goods} onChange={(e) => setGoods(e.target.value)} placeholder={`Goods amount to refund (max ${o.amount})`} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2" />}
      {prev && ["refund", "partial", "return_refund"].includes(remedy) && (
        <table className="w-full text-[11px] mb-2 bg-blue-50/50 rounded-lg">
          <tbody>
            <tr><td className="px-2 py-0.5">Goods</td><td className="text-right px-2">{formatNaira(prev.goods)}</td></tr>
            <tr><td className="px-2 py-0.5">Buyer commission returned</td><td className="text-right px-2">{formatNaira(prev.buyer_commission_share)}</td></tr>
            {prev.delivery_refund > 0 && <tr><td className="px-2 py-0.5">Delivery fee returned</td><td className="text-right px-2">{formatNaira(prev.delivery_refund)}</td></tr>}
            {prev.fee_withheld > 0 && <tr><td className="px-2 py-0.5">Processing fee kept</td><td className="text-right px-2">− {formatNaira(prev.fee_withheld)}</td></tr>}
            <tr className="font-bold border-t border-blue-100"><td className="px-2 py-1">Buyer receives</td><td className="text-right px-2">{formatNaira(prev.total_to_buyer)}</td></tr>
            {prev.seller_clawback > 0 && <tr><td className="px-2 py-0.5">Taken back from seller</td><td className="text-right px-2">{formatNaira(prev.seller_clawback)}</td></tr>}
            {prev.fund_paid > 0 && <tr><td className="px-2 py-0.5">Paid by Delivery Protection Fund</td><td className="text-right px-2">{formatNaira(prev.fund_paid)}</td></tr>}
            {prev.allowance_units > 0 && <tr><td colSpan={2} className="px-2 py-1 text-gray-600">Breakage allowance for this product: {prev.allowance_pct}% = {prev.allowance_units} unit(s) not refunded. Use &quot;Partial refund&quot; to override.</td></tr>}
            {prev.needs_second && <tr><td colSpan={2} className="px-2 py-1 text-amber-800 font-semibold">A second admin must approve this amount.</td></tr>}
          </tbody>
        </table>
      )}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Reason for the decision. Both sides will read this." className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs mb-2" />
      <button disabled={busy || note.trim().length < 10} onClick={() => { if (confirm(remedy === "reject" ? "Reject this claim?" : "Confirm this decision? Money will move.")) call("admin_decide_marketplace_claim", { p_claim: c.id, p_fault: fault, p_remedy: remedy, p_goods_amount: remedy === "partial" && goods ? Number(goods) : null, p_note: note, p_return_to: retTo }, "Decision recorded."); }} className="w-full py-2.5 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">{busy ? "Working…" : "Record decision"}</button>
    </Box>
  );
}
