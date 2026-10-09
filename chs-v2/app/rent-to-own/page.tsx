"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RoleBadge from "@/components/RoleBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import WalletQuickView from "@/components/WalletQuickView";
import PaymentSafetyNotice from "@/components/PaymentSafetyNotice";
import { Req } from "@/components/FormMarks";

// The Mortgage Installment Panel: every mortgage (Rent to Own) the buyer is
// paying, side by side. Each card shows the last payment, the next one, and
// lets the buyer pay the installment, pay more, or pay everything off. Every
// payment goes through the CHS wallet; the FINAL payment is held by CHS until
// the owner hands over the property documents and the buyer (or CHS) confirms.

interface RtoAgreement {
  id: string;
  property_id: string;
  total_price: number;
  monthly_amount: number;
  portion_pct: number;
  total_paid: number;
  ownership_pct: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  final_held_amount: number | null;
  properties: { title: string; location_area: string; street_address: string | null } | null;
  seller: { full_name: string } | null;
}
interface Payment { id: string; agreement_id: string; amount: number; reference: string; paid_at: string }
interface Handover {
  status: "requested" | "sent" | "confirmed"; recipient_name: string; delivery_address: string; method: string; max_days: number;
  deadline: string; overdue: boolean; sent_at: string | null; sent_method: string | null; tracking: string | null; proof_note: string | null; confirmed_at: string | null;
}

// What the buyer is told. Until CHS passes on the owner's answer, the buyer is
// only told the request is with the owner, whatever the owner has decided.
const STATUS_LABELS: Record<string, string> = {
  awaiting_admin_relay: "CHS is reviewing your request. Nothing has been charged.",
  requested: "CHS has passed your request to the owner. You will be told as soon as they decide.",
  owner_approved: "CHS has passed your request to the owner. You will be told as soon as they decide.",
  owner_declined: "CHS has passed your request to the owner. You will be told as soon as they decide.",
  active: "Active",
  awaiting_handover: "Fully paid. Waiting for the property documents",
  completed: "Completed. The documents have been handed over",
  defaulted: "Defaulted",
  cancelled: "Cancelled",
  declined: "Not taken forward",
};

export default function RentToOwnPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [agreements, setAgreements] = useState<RtoAgreement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [handovers, setHandovers] = useState<Record<string, Handover | null>>({});
  const [buyerCommissionPct, setBuyerCommissionPct] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMessage, setPayMessage] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [docForm, setDocForm] = useState<Record<string, { name: string; address: string; phone: string; method: string; days: string }>>({});
  const [docMsg, setDocMsg] = useState<Record<string, string>>({});

  async function loadData() {
    if (!session) return;
    setLoading(true);
    const [agreementsRes, settingRes] = await Promise.all([
      supabase
        .from("rent_to_own_agreements")
        .select("id, property_id, total_price, monthly_amount, portion_pct, total_paid, ownership_pct, status, started_at, completed_at, final_held_amount, properties(title, location_area, street_address), seller:seller_id(full_name)")
        .eq("buyer_id", session.user.id)
        .order("started_at", { ascending: false }),
      supabase.from("platform_settings").select("value").eq("key", "rent_to_own_buyer_commission_pct").maybeSingle(),
    ]);
    const list = (agreementsRes.data as unknown as RtoAgreement[]) || [];
    setAgreements(list);
    setBuyerCommissionPct(settingRes.data ? Number(settingRes.data.value) : 0);

    const ids = list.map((a) => a.id);
    if (ids.length > 0) {
      const { data: pays } = await supabase.from("rent_to_own_payments").select("id, agreement_id, amount, reference, paid_at").in("agreement_id", ids).order("paid_at", { ascending: false });
      setPayments((pays as Payment[]) || []);
    }
    const hand: Record<string, Handover | null> = {};
    await Promise.all(list.filter((a) => a.status === "awaiting_handover" || a.status === "completed").map(async (a) => {
      const { data } = await supabase.rpc("get_rto_handover", { p_agreement_id: a.id });
      hand[a.id] = (data as Handover) || null;
    }));
    setHandovers(hand);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  async function pay(agreementId: string, amount: number | null) {
    setPayingId(agreementId);
    setPayMessage((prev) => ({ ...prev, [agreementId]: "" }));
    const { data, error } = await supabase.rpc("pay_rent_to_own", { p_agreement_id: agreementId, p_amount: amount });
    setPayingId(null);
    if (error) {
      setPayMessage((prev) => ({
        ...prev,
        [agreementId]: error.message.includes("insufficient_balance")
          ? "Your wallet does not hold enough for this payment (the amount plus your CHS commission). Fund your wallet and try again."
          : error.message,
      }));
      return;
    }
    setCustom((c) => ({ ...c, [agreementId]: "" }));
    setPayMessage((prev) => ({
      ...prev,
      [agreementId]: data.awaiting_handover
        ? `✓ Paid in full. Reference ${data.reference}. Now request your property documents below. The final payment stays with CHS until you have them.`
        : `✓ Paid ${formatNaira(data.real_total_paid)} (${formatNaira(data.installment)} + your ${formatNaira(data.buyer_commission)} CHS commission). Reference ${data.reference}. ${formatNaira(data.remaining)} remains.`,
    }));
    loadData();
  }

  async function requestDocs(a: RtoAgreement) {
    const f = docForm[a.id] || { name: "", address: "", phone: "", method: "courier", days: "14" };
    setDocMsg((m) => ({ ...m, [a.id]: "" }));
    const { error } = await supabase.rpc("request_rto_documents", {
      p_agreement_id: a.id, p_recipient_name: f.name, p_address: f.address, p_phone: f.phone, p_method: f.method || "courier", p_max_days: parseInt(f.days) || 14,
    });
    if (error) { setDocMsg((m) => ({ ...m, [a.id]: error.message })); return; }
    loadData();
  }

  async function confirmDocs(a: RtoAgreement) {
    const { error } = await supabase.rpc("confirm_rto_documents_received", { p_agreement_id: a.id });
    if (error) { setDocMsg((m) => ({ ...m, [a.id]: error.message })); return; }
    loadData();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  const active = agreements.filter((a) => a.status === "active");
  const handover = agreements.filter((a) => a.status === "awaiting_handover" || a.status === "completed");
  const other = agreements.filter((a) => !["active", "awaiting_handover", "completed"].includes(a.status));

  const renderCard = (a: RtoAgreement, children?: React.ReactNode) => {
    const mine = payments.filter((p) => p.agreement_id === a.id); // newest first
    const remaining = Math.max(0, a.total_price - a.total_paid);
    const nextAmount = Math.min(a.monthly_amount, remaining);
    return (
      <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-3">
        <p className="text-sm font-semibold text-chs-charcoal">{a.properties?.title}</p>
        <p className="text-xs font-semibold text-gray-600">📍 {a.properties?.street_address || "No street address on file"}</p>
        <p className="text-xs text-gray-500">{a.properties?.location_area} · Seller: {a.seller?.full_name || "—"}</p>
        <div className="bg-white rounded-lg p-2.5 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-500">Ownership so far</span>
            <span className="text-xs font-bold text-chs-charcoal">{Number(a.ownership_pct).toFixed(2)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1"><div className="bg-chs-red h-1.5 rounded-full" style={{ width: `${Math.min(100, Number(a.ownership_pct))}%` }} /></div>
          <div className="flex justify-between mt-2 text-[11px] text-gray-600"><span>Paid so far ({mine.length} payment{mine.length !== 1 ? "s" : ""})</span><span>{formatNaira(a.total_paid)}</span></div>
          <div className="flex justify-between text-[11px] text-gray-600"><span>Remaining</span><span>{formatNaira(remaining)}</span></div>
          <div className="flex justify-between text-[11px] text-gray-600"><span>Total price</span><span>{formatNaira(a.total_price)}</span></div>
          {mine[0] && <p className="text-[10px] text-gray-500 mt-1.5">Last payment: {formatNaira(mine[0].amount)} on {new Date(mine[0].paid_at).toLocaleDateString()} ({mine[0].reference})</p>}
          <p className="text-[10px] text-gray-500 mt-1">Every payment is received by CHS first and then passed to the owner, so there is a record of each one.</p>
          {a.status === "active" && remaining > 0 && <p className="text-[10px] font-semibold text-chs-charcoal mt-0.5">Next payment: {formatNaira(nextAmount)} (plus your CHS commission)</p>}
        </div>
        {children}
        {mine.length > 0 && (
          <details className="mt-2">
            <summary className="text-[10px] font-semibold text-gray-500 cursor-pointer">All payments ({mine.length})</summary>
            {mine.map((p) => (
              <p key={p.id} className="text-[10px] text-gray-500 flex justify-between border-b border-gray-100 py-1"><span>{new Date(p.paid_at).toLocaleDateString()} · {p.reference}</span><span>{formatNaira(p.amount)}</span></p>
            ))}
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen zone-buyer bg-[var(--zone-bg)] pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <RoleBadge label="Mortgage Installment Panel" />
        <div className="flex justify-between items-end mt-1 gap-2">
          <h1 className="font-serif text-lg font-bold">My Mortgage Payments</h1>
          {session && <WalletQuickView userId={session.user.id} />}
        </div>
        <div className="flex gap-1.5 mt-2">
          <Link href="/my-offers" className="bg-white/15 text-[10px] font-semibold px-3 py-1.5 rounded-full">My Offers</Link>
          <Link href="/my-receipts" className="bg-white/15 text-[10px] font-semibold px-3 py-1.5 rounded-full">My Transactions</Link>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        <PaymentSafetyNotice variant="compact" />
        {agreements.length === 0 ? (
          <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-sm text-gray-500">No Mortgage (Rent to Own) agreements yet.</p>
            <p className="text-xs text-gray-400 mt-1">Browse properties listed as Mortgage (Rent to Own) and request one from the property page.</p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div>
                <p className="text-xs font-bold text-chs-charcoal mb-2">Payments in progress ({active.length})</p>
                {active.map((a) => {
                  const remaining = Math.max(0, a.total_price - a.total_paid);
                  const installment = Math.min(a.monthly_amount, remaining);
                  const commissionOn = (x: number) => Math.round((x * buyerCommissionPct) / 100);
                  const customAmount = Number(custom[a.id] || 0);
                  return (
                    <Fragment key={a.id}>{renderCard(a, (<>
                      <div className="bg-white rounded-lg p-2.5 mt-2 text-[11px] text-gray-600">
                        <div className="flex justify-between"><span>Installment</span><span>{formatNaira(installment)}</span></div>
                        <div className="flex justify-between"><span>Your CHS commission ({buyerCommissionPct}%)</span><span>{formatNaira(commissionOn(installment))}</span></div>
                        <div className="flex justify-between font-bold text-chs-charcoal border-t border-gray-100 pt-1 mt-1"><span>Total from your wallet</span><span>{formatNaira(installment + commissionOn(installment))}</span></div>
                      </div>
                      {payMessage[a.id] && <p className="text-[10px] text-gray-600 mt-1.5">{payMessage[a.id]}</p>}
                      <button onClick={() => pay(a.id, null)} disabled={payingId === a.id} className="mt-2 w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                        {payingId === a.id ? "Processing..." : `Pay next installment: ${formatNaira(installment + commissionOn(installment))}`}
                      </button>
                      <div className="mt-2 bg-white rounded-lg p-2.5">
                        <p className="text-[10px] font-bold text-chs-charcoal">Pay more, or pay it all off</p>
                        <p className="text-[10px] text-gray-500 mb-1.5">Any amount from one installment up to what you still owe ({formatNaira(remaining)}). Paying more shortens your agreement.</p>
                        <div className="flex gap-1.5">
                          <input type="number" min={installment} max={remaining} value={custom[a.id] || ""} onChange={(e) => setCustom({ ...custom, [a.id]: e.target.value })} placeholder={`${installment} to ${remaining}`} className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-xs" />
                          <button onClick={() => pay(a.id, customAmount)} disabled={payingId === a.id || !customAmount} className="px-3 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Pay this</button>
                        </div>
                        {customAmount > 0 && <p className="text-[10px] text-gray-500 mt-1">From your wallet: {formatNaira(customAmount + commissionOn(customAmount))} (includes {formatNaira(commissionOn(customAmount))} commission)</p>}
                        <button onClick={() => pay(a.id, remaining)} disabled={payingId === a.id} className="mt-1.5 w-full py-1.5 rounded-full border border-chs-red text-chs-red text-[11px] font-semibold disabled:opacity-50">
                          Pay everything now: {formatNaira(remaining + commissionOn(remaining))}
                        </button>
                        <p className="text-[9px] text-gray-400 mt-1">Your last payment is held by CHS until the owner hands over the property documents.</p>
                      </div>
                    </>))}</Fragment>
                  );
                })}
              </div>
            )}

            {handover.length > 0 && (
              <div>
                <p className="text-xs font-bold text-chs-charcoal mb-2">Documents and handover ({handover.length})</p>
                {handover.map((a) => {
                  const h = handovers[a.id];
                  const f = docForm[a.id] || { name: "", address: "", phone: "", method: "courier", days: "14" };
                  const setF = (patch: Partial<typeof f>) => setDocForm({ ...docForm, [a.id]: { ...f, ...patch } });
                  return (
                    <Fragment key={a.id}>{renderCard(a, (<>
                      <div className="mt-2 bg-white rounded-lg p-2.5">
                        <p className="text-[11px] font-bold text-chs-charcoal">
                          {a.status === "completed" ? "✓ Handover complete" : "🔒 You have paid in full. The final payment is held by CHS"}
                        </p>
                        {payMessage[a.id] && <p className="text-[10px] text-gray-600 mt-1">{payMessage[a.id]}</p>}
                        <p className="text-[10px] text-gray-500 mt-0.5">Ownership becomes legal when the owner hands over the property documents. Until then CHS holds the last payment, so the owner has every reason to send them.</p>
                        {!h && (
                          <div className="mt-2 space-y-1.5">
                            <p className="text-[10px] font-bold text-chs-charcoal">Click here to demand the documents of this property</p>
                            <label className="text-[10px] font-semibold text-gray-600">Recipient name <Req /></label>
                            <input value={f.name} onChange={(e) => setF({ name: e.target.value })} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
                            <label className="text-[10px] font-semibold text-gray-600">Delivery address <Req /></label>
                            <input value={f.address} onChange={(e) => setF({ address: e.target.value })} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
                            <label className="text-[10px] font-semibold text-gray-600">Phone CHS can reach <Req /></label>
                            <input value={f.phone} onChange={(e) => setF({ phone: e.target.value })} placeholder="Kept by CHS. The owner never sees it" className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] font-semibold text-gray-600">Delivery method</label>
                                <select value={f.method} onChange={(e) => setF({ method: e.target.value })} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-white">
                                  <option value="courier">Courier</option><option value="in_person">In person</option><option value="registered_post">Registered post</option>
                                </select>
                              </div>
                              <div className="w-28">
                                <label className="text-[10px] font-semibold text-gray-600">Within (days) <Req /></label>
                                <input type="number" min={1} max={60} value={f.days} onChange={(e) => setF({ days: e.target.value })} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
                              </div>
                            </div>
                            <button onClick={() => requestDocs(a)} className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold">Request my property documents</button>
                          </div>
                        )}
                        {h && (
                          <div className="mt-2 text-[11px] text-gray-700 space-y-0.5">
                            <p>To: {h.recipient_name}, {h.delivery_address}</p>
                            <p>The owner must deliver by <b>{new Date(h.deadline).toLocaleDateString()}</b> ({h.max_days} days){h.overdue && h.status !== "confirmed" ? " · overdue, CHS has been alerted" : ""}</p>
                            {h.status === "requested" && <p className="text-amber-700 font-semibold">Waiting for the owner to send them and show proof.</p>}
                            {h.status === "sent" && (
                              <>
                                <p className="text-green-700 font-semibold">The owner says they were sent{h.sent_method ? ` by ${h.sent_method}` : ""}{h.tracking ? ` (tracking ${h.tracking})` : ""}.</p>
                                {h.proof_note && <p className="italic text-gray-500">&quot;{h.proof_note}&quot;</p>}
                                {a.status === "awaiting_handover" && (
                                  <button onClick={() => confirmDocs(a)} className="mt-1.5 w-full py-2 rounded-full bg-green-600 text-white text-xs font-semibold">✓ I have received my documents. Release the final payment</button>
                                )}
                              </>
                            )}
                            {h.status === "confirmed" && <p className="text-green-700 font-semibold">✓ You confirmed receipt.</p>}
                          </div>
                        )}
                        {docMsg[a.id] && <p className="text-[10px] text-chs-red mt-1">{docMsg[a.id]}</p>}
                      </div>
                    </>))}</Fragment>
                  );
                })}
              </div>
            )}

            {other.length > 0 && (
              <div>
                <p className="text-xs font-bold text-chs-charcoal mb-2">Requests and other agreements</p>
                {other.map((a) => (
                  <div key={a.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                    <p className="text-sm font-semibold text-chs-charcoal">{a.properties?.title}</p>
                    <p className="text-xs text-gray-500">{a.properties?.location_area}</p>
                    <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${
                      a.status === "declined" || a.status === "cancelled" || a.status === "defaulted" ? "text-gray-500 bg-gray-100" : "text-chs-amber-dark bg-chs-amber-light"}`}>
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
