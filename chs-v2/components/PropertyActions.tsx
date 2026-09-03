"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Property } from "@/types/property";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import CurrencyInput from "./CurrencyInput";
import InspectionBookingForm from "./InspectionBookingForm";
import RentalApplicationForm from "./RentalApplicationForm";
import ShortletBookingForm from "./ShortletBookingForm";
import IdentityVerificationGate from "./IdentityVerificationGate";
import OfferMessageThread from "./OfferMessageThread";

type ActiveForm = "none" | "offer" | "inspection" | "rentalApplication" | "shortlet";

export default function PropertyActions({ property }: { property: Property }) {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [activeForm, setActiveForm] = useState<ActiveForm>("none");
  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerSuccess, setOfferSuccess] = useState(false);
  const [inspectionSuccess, setInspectionSuccess] = useState(false);
  const [rentalApplicationSuccess, setRentalApplicationSuccess] = useState(false);
  const [shortletSuccess, setShortletSuccess] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [rentToOwnSuccess, setRentToOwnSuccess] = useState(false);
  const [rentToOwnSubmitting, setRentToOwnSubmitting] = useState(false);

  // Real, fundamental gap found through direct client testing: a
  // buyer whose offer was accepted previously had no real way to
  // actually pay for the property at all — only commission had ever
  // been tested. Built as one real, transparent checkout that
  // includes the buyer's own commission automatically.
  const [myAcceptedOffer, setMyAcceptedOffer] = useState<{ id: string; accepts_installment: boolean; downpayment_pct: number | null; amount_paid: number; amount: number; acceptance_condition: string | null } | null>(null);
  // Real, new fix per direct client testing: a buyer previously had no
  // way to see or respond to negotiation messages until their offer
  // was already accepted — meaning the exact real moment a seller
  // declines and asks for a better price, the buyer had nowhere to
  // continue the conversation at all. This tracks their most recent
  // real offer regardless of status, as long as it's still genuinely
  // negotiable (not yet paid for).
  const [myLatestOffer, setMyLatestOffer] = useState<{ id: string; status: string } | null>(null);
  const [breakdown, setBreakdown] = useState<{ offer_amount: number; buyer_pct: number; buyer_commission: number; buyer_total: number } | null>(null);
  const [installmentAmount, setInstallmentAmount] = useState<number | "">("");
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [myPaidOffer, setMyPaidOffer] = useState<{ id: string; document_deadline: string; legal_transfer_confirmed: boolean } | null>(null);
  const [saleDocuments, setSaleDocuments] = useState<{ id: string; document_type: string; file_url: string; verification_status: string }[]>([]);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<"none" | "requested" | "dispatched">("none");
  const [requestingDispatch, setRequestingDispatch] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [confirmingDocuments, setConfirmingDocuments] = useState(false);
  const [documentsConfirmed, setDocumentsConfirmed] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState(false);

  useEffect(() => {
    if (!session || property.purpose !== "sale") return;
    supabase
      .from("offers")
      .select("id, status")
      .eq("property_id", property.id)
      .eq("buyer_id", session.user.id)
      .eq("payment_status", "unpaid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setMyLatestOffer(data));

    supabase
      .from("offers")
      .select("id, accepts_installment, downpayment_pct, amount_paid, amount, acceptance_condition")
      .eq("property_id", property.id)
      .eq("buyer_id", session.user.id)
      .eq("status", "accepted")
      .eq("payment_status", "unpaid")
      .maybeSingle()
      .then(({ data }) => {
        setMyAcceptedOffer(data);
        if (data) {
          // Real, new fix — a property with a genuine, agent-set
          // commission rate uses a completely different real
          // breakdown: the buyer pays exactly the agreed price with
          // no CHS commission added on top, since CHS's real cut in
          // this model comes only from the agent's own earnings.
          if (property.agent_commission_pct) {
            supabase.rpc("get_agent_commission_breakdown", { p_offer_id: data.id }).then(({ data: bd }) => {
              if (bd && bd[0]) {
                setBreakdown({
                  offer_amount: Number(bd[0].offer_amount),
                  buyer_pct: 0,
                  buyer_commission: 0,
                  buyer_total: Number(bd[0].buyer_total),
                });
              }
            });
            return;
          }
          // Real, deliberate design per direct client instruction: the
          // buyer only ever sees their own real numbers — price, their
          // own commission, their own total. What the seller nets is
          // never shown here; each side sees only what they themselves
          // owe, matching how real negotiation actually works.
          supabase.rpc("get_sale_commission_breakdown", { p_offer_id: data.id }).then(({ data: bd }) => {
            if (bd && bd[0]) {
              setBreakdown({
                offer_amount: Number(bd[0].offer_amount),
                buyer_pct: Number(bd[0].buyer_pct),
                buyer_commission: Number(bd[0].buyer_commission),
                buyer_total: Number(bd[0].buyer_total),
              });
            }
          });
        }
      });
    supabase
      .from("offers")
      .select("id, document_deadline, legal_transfer_confirmed")
      .eq("property_id", property.id)
      .eq("buyer_id", session.user.id)
      .eq("payment_status", "paid")
      .eq("legal_transfer_confirmed", false)
      .maybeSingle()
      .then(({ data }) => {
        setMyPaidOffer(data);
        if (data) {
          setDeadlinePassed(new Date(data.document_deadline).getTime() < Date.now());
          supabase.from("property_sale_documents").select("id, document_type, file_url, verification_status")
            .eq("property_id", property.id)
            .then(({ data: docs }) => setSaleDocuments(docs || []));
          supabase.from("document_dispatch_requests").select("status").eq("offer_id", data.id).maybeSingle().then(({ data: dispatch }) => {
            setDispatchStatus((dispatch?.status as "requested" | "dispatched") || "none");
          });
        }
      });
  }, [session, property.id, property.purpose]);

  async function handleRequestDispatch() {
    if (!myPaidOffer) return;
    setRequestingDispatch(true);
    const { error } = await supabase.rpc("request_document_dispatch", { p_offer_id: myPaidOffer.id, p_delivery_note: deliveryNote.trim() || null });
    setRequestingDispatch(false);
    if (!error) setDispatchStatus("requested");
  }

  async function handleConfirmDocumentsReceived() {
    if (!myPaidOffer) return;
    setConfirmingDocuments(true);
    setRefundError(null);
    const { error } = await supabase.rpc("confirm_documents_received", { p_offer_id: myPaidOffer.id });
    setConfirmingDocuments(false);
    if (error) {
      setRefundError(error.message);
      return;
    }
    setDocumentsConfirmed(true);
  }

  async function handleRequestRefund() {
    if (!myPaidOffer) return;
    setRequestingRefund(true);
    setRefundError(null);
    const { error: rpcError } = await supabase.rpc("request_sale_refund", { p_offer_id: myPaidOffer.id });
    setRequestingRefund(false);
    if (rpcError) {
      setRefundError(rpcError.message);
      return;
    }
    setRefundSuccess(true);
  }

  async function handlePayForProperty() {
    if (!myAcceptedOffer) return;
    setPaying(true);
    setPaymentError(null);
    // Real fix — a property with a genuine, agent-set commission rate
    // must use the real, separate agent-managed payment function, not
    // the standard CHS-commission one, or the whole real point of the
    // model (CHS's cut coming only from the agent's earnings) breaks.
    const { error: rpcError } = property.agent_commission_pct
      ? await supabase.rpc("pay_for_property_agent_managed", { p_offer_id: myAcceptedOffer.id })
      : await supabase.rpc("pay_for_property", { p_offer_id: myAcceptedOffer.id });
    setPaying(false);
    if (rpcError) {
      setPaymentError(rpcError.message);
      return;
    }
    setPaymentSuccess(true);
  }

  async function handlePaySaleInstallment() {
    if (!myAcceptedOffer || !installmentAmount) return;
    setPaying(true);
    setPaymentError(null);
    const { error: rpcError } = await supabase.rpc("pay_sale_installment", { p_offer_id: myAcceptedOffer.id, p_amount: installmentAmount });
    setPaying(false);
    if (rpcError) {
      setPaymentError(rpcError.message);
      return;
    }
    setInstallmentAmount("");
    // Real re-fetch to show the updated remaining balance, or the
    // real "fully paid" success state if this was the final payment.
    const { data } = await supabase
      .from("offers")
      .select("id, accepts_installment, downpayment_pct, amount_paid, amount, payment_status, acceptance_condition")
      .eq("id", myAcceptedOffer.id)
      .single();
    if (data?.payment_status === "paid") {
      setPaymentSuccess(true);
    } else {
      setMyAcceptedOffer(data);
    }
  }

  // The real fix for #17's core problem: an unregistered visitor trying
  // to do something — not just browse — gets sent to register, with the
  // exact property they were looking at remembered so they land right
  // back here once they're done, rather than a generic welcome screen.
  function requireLoginThen(action: () => void) {
    if (loading) return;
    if (!session) {
      sessionStorage.setItem("chs_pending_return_to", `/property/${property.id}`);
      router.push("/register");
      return;
    }
    action();
  }

  async function handleRequestRentToOwn() {
    setRentToOwnSubmitting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("request_rent_to_own", { p_property_id: property.id });
    setRentToOwnSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setRentToOwnSuccess(true);
  }

  async function handleSubmitOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || amount < 1000) {
      setError("Please enter a valid offer amount.");
      return;
    }
    if (!identityVerified) {
      setError("Please complete identity verification before submitting a real offer.");
      return;
    }
    if (!session) return;

    setError(null);
    setSubmitting(true);

    // A genuine, shared database write — visible immediately to the
    // property's real owner and to admin, on their own separate
    // devices, the moment this succeeds. Exactly the real gap the
    // original app's version of this feature had.
    const { error: insertError } = await supabase.from("offers").insert({
      property_id: property.id,
      buyer_id: session.user.id,
      amount,
      note: note.trim() || null,
    });

    if (insertError) {
      setError(insertError.message.includes("contact info") || insertError.message.includes("phone number") || insertError.message.includes("email")
        ? insertError.message
        : "Could not submit your offer. Please try again.");
      setSubmitting(false);
      return;
    }

    setOfferSuccess(true);
    setSubmitting(false);
  }

  if (myPaidOffer) {
    if (refundSuccess) {
      return (
        <div className="bg-white rounded-xl border-2 border-green-600 p-4 text-center">
          <p className="text-sm font-bold text-green-700">✓ Refund issued — your full payment is back in your wallet.</p>
        </div>
      );
    }
    if (documentsConfirmed) {
      return (
        <div className="bg-white rounded-xl border-2 border-green-600 p-4 text-center">
          <p className="text-sm font-bold text-green-700">✓ You confirmed receipt — the seller&apos;s funds have been released.</p>
        </div>
      );
    }
    return (
      <>
      <div className="bg-white rounded-xl border-2 border-chs-amber-dark p-4">
        <p className="text-sm font-bold text-chs-charcoal mb-1">✓ Payment complete — this property is now yours!</p>
        <p className="text-xs text-gray-500 mb-3">
          Real documents are due to you by {new Date(myPaidOffer.document_deadline).toLocaleDateString()}. If they haven&apos;t arrived by then, you can request a full refund below.
        </p>
        {/* Real, new fix — the actual verified legal documents,
            uploaded and confirmed by CHS at listing time, made
            genuinely downloadable to the paying buyer directly. This
            was a real gap: the whole "dispatch" flow below only ever
            tracked physical hard-copy delivery — the real digital soft
            copies were never actually reachable anywhere. */}
        {saleDocuments.length > 0 && (
          <div className="bg-[var(--zone-card)] rounded-lg p-3 mb-3">
            <p className="text-xs font-bold text-chs-charcoal mb-2">📄 Your Real Property Documents</p>
            {saleDocuments.map((d) => (
              <div key={d.id} className="flex justify-between items-center text-xs py-1">
                <span className="text-gray-600 capitalize">{d.document_type.replace(/_/g, " ")}</span>
                {d.verification_status === "verified" ? (
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-chs-red font-semibold underline">
                    Download
                  </a>
                ) : (
                  <span className="text-[10px] text-gray-400">Not yet verified</span>
                )}
              </div>
            ))}
          </div>
        )}
        {dispatchStatus === "none" && (
          <>
            <textarea placeholder="Optional — your delivery address for the hard copies, and when you'd like to receive them"
              value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)}
              rows={2} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] mb-1.5" />
            <button onClick={handleRequestDispatch} disabled={requestingDispatch}
              className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold mb-2 disabled:opacity-50">
              {requestingDispatch ? "Sending request..." : "Request soft copies of my documents"}
            </button>
          </>
        )}
        {dispatchStatus === "requested" && (
          <p className="text-xs bg-chs-amber-light text-chs-amber-dark rounded-lg p-2.5 mb-2">⏳ Waiting on the seller to dispatch your real documents.</p>
        )}
        {dispatchStatus === "dispatched" && (
          <>
            <p className="text-xs bg-green-50 text-green-700 rounded-lg p-2.5 mb-2">📦 The seller has marked your real documents as dispatched. Confirm below once you genuinely receive them.</p>
            {refundError && <p className="text-xs text-chs-red mb-2">{refundError}</p>}
            <button onClick={handleConfirmDocumentsReceived} disabled={confirmingDocuments}
              className="w-full py-2.5 rounded-full bg-green-600 text-white text-sm font-semibold mb-2 disabled:opacity-50">
              {confirmingDocuments ? "Processing..." : "✓ I've received my real documents"}
            </button>
          </>
        )}
        {refundError && <p className="text-xs text-chs-red mb-2">{refundError}</p>}
        <button onClick={handleRequestRefund} disabled={!deadlinePassed || requestingRefund}
          className="w-full py-2.5 rounded-full bg-gray-200 text-gray-600 text-sm font-semibold disabled:opacity-40">
          {requestingRefund ? "Processing..." : deadlinePassed ? "Request refund & cancel this deal" : "Refund available after the deadline above"}
        </button>
      </div>
      {/* Real, new fix — a genuine, free chat channel remains
          available post-payment so the buyer and seller can safely
          exchange real contact details and coordinate the physical
          document handover, exactly matching what the backend
          already permits once payment is complete. */}
      {session && myPaidOffer && (
        <OfferMessageThread offerId={myPaidOffer.id} viewerRole="buyer" viewerId={session.user.id} />
      )}
    </>
    );
  }

  // Real, new negotiation view — shown whenever the buyer has a real,
  // still-negotiable offer that hasn't been accepted (pending, or
  // declined with a real counter-message from the seller). This is
  // the exact gap found through direct client testing: a seller could
  // decline and ask for a better price, but the buyer had nowhere to
  // see that message or respond with a revised number at all.
  if (myLatestOffer && myLatestOffer.status !== "accepted" && session) {
    return (
      <div className="bg-white rounded-xl border-2 border-chs-amber-dark p-4">
        <p className="text-sm font-bold text-chs-charcoal mb-1">
          {myLatestOffer.status === "rejected" ? "Your offer was declined — negotiation continues below" : "Your offer is with the seller"}
        </p>
        <p className="text-xs text-gray-500 mb-2">
          {myLatestOffer.status === "rejected"
            ? "The seller may have left a real counter-message below. Reply with a revised offer to keep negotiating."
            : "You'll be notified here the moment the seller responds."}
        </p>
        <OfferMessageThread offerId={myLatestOffer.id} viewerRole="buyer" viewerId={session.user.id} />
      </div>
    );
  }

  if (myAcceptedOffer && breakdown) {
    if (paymentSuccess) {
      return (
        <div className="bg-white rounded-xl border-2 border-green-600 p-4 text-center">
          <p className="text-sm font-bold text-green-700 mb-1">🎉 Payment successful — this property is now yours!</p>
        </div>
      );
    }
    return (
      <>
      <div className="bg-white rounded-xl border-2 border-chs-red p-4">
        <p className="text-sm font-bold text-chs-charcoal mb-2">✓ Offer accepted — proceed to payment</p>
        {myAcceptedOffer.acceptance_condition && (
          <p className="text-xs bg-chs-amber-light text-chs-amber-dark rounded-lg p-2.5 mb-3">
            ⚠️ {myAcceptedOffer.acceptance_condition}
          </p>
        )}
        {myAcceptedOffer.accepts_installment ? (
          <>
            <div className="bg-[var(--zone-card)] rounded-lg p-3 mb-3 space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-gray-500">Total accepted price</span><span className="font-semibold">{formatNaira(breakdown.offer_amount)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Real amount paid so far</span><span className="font-semibold">{formatNaira(myAcceptedOffer.amount_paid)}</span></div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5 mt-1"><span className="font-bold text-chs-charcoal">Real remaining balance</span><span className="font-bold text-chs-red">{formatNaira(myAcceptedOffer.amount - myAcceptedOffer.amount_paid)}</span></div>
            </div>
            {myAcceptedOffer.amount_paid === 0 && (
              <p className="text-[10px] text-gray-500 mb-2">The seller requires a real minimum down payment of {myAcceptedOffer.downpayment_pct}% ({formatNaira(breakdown.offer_amount * (myAcceptedOffer.downpayment_pct || 0) / 100)}) to begin. Platform commission ({breakdown.buyer_pct}%) is added to whatever amount you pay each time.</p>
            )}
            <input type="number" placeholder="Amount to pay now" value={installmentAmount}
              onChange={(e) => setInstallmentAmount(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2" />
            <p className="text-[10px] text-gray-500 mb-3">After your final installment, your funds are held safely by CHS. We act on your behalf to ensure every real legal document is delivered within 14 working days — if not, you can request a full refund.</p>
            {paymentError && <p className="text-xs text-chs-red mb-2">{paymentError}</p>}
            <button onClick={handlePaySaleInstallment} disabled={paying || !installmentAmount}
              className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {paying ? "Processing payment..." : "Pay this installment now"}
            </button>
          </>
        ) : (
          <>
            <div className="bg-[var(--zone-card)] rounded-lg p-3 mb-3 space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-gray-500">Total accepted price</span><span className="font-semibold">{formatNaira(breakdown.offer_amount)}</span></div>
              {!property.agent_commission_pct && (
                <div className="flex justify-between text-xs"><span className="text-gray-500">Platform commission ({breakdown.buyer_pct}%)</span><span className="font-semibold">{formatNaira(breakdown.buyer_commission)}</span></div>
              )}
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5 mt-1"><span className="font-bold text-chs-charcoal">Total due</span><span className="font-bold text-chs-red">{formatNaira(breakdown.buyer_total)}</span></div>
            </div>
            <p className="text-[10px] text-gray-500 mb-3">
              After payment, your funds are held safely by CHS. We act on your behalf to ensure every real legal document is delivered to you within 14 working days. If they haven&apos;t arrived by then, you can request a full refund and cancel this deal, right from your dashboard.
            </p>
            {paymentError && <p className="text-xs text-chs-red mb-2">{paymentError}</p>}
            <button onClick={handlePayForProperty} disabled={paying}
              className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {paying ? "Processing payment..." : `Pay ${formatNaira(breakdown.buyer_total)} now`}
            </button>
          </>
        )}
      </div>
      {session && <OfferMessageThread offerId={myAcceptedOffer.id} viewerRole="buyer" viewerId={session.user.id} />}
    </>
    );
  }

  if (offerSuccess) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
        <p className="text-sm font-semibold text-chs-charcoal mb-1">✓ Offer submitted</p>
        <p className="text-xs text-gray-500">
          Your offer of {formatNaira(amount as number)} has been sent to CHS — the owner will be
          notified and can accept, counter, or decline.
        </p>
      </div>
    );
  }

  if (inspectionSuccess) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
        <p className="text-sm font-semibold text-chs-charcoal mb-1">✓ Inspection requested</p>
        <p className="text-xs text-gray-500">
          CHS and the owner will confirm your requested time shortly.
        </p>
      </div>
    );
  }

  if (rentalApplicationSuccess) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
        <p className="text-sm font-semibold text-chs-charcoal mb-1">✓ Application submitted</p>
        <p className="text-xs text-gray-500">
          CHS will review your documents, then the owner makes the final decision. You&apos;ll be
          notified either way.
        </p>
      </div>
    );
  }

  if (shortletSuccess) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
        <p className="text-sm font-semibold text-chs-charcoal mb-1">✓ Booking confirmed</p>
        <p className="text-xs text-gray-500">Your dates are genuinely secured — no one else can book over them.</p>
      </div>
    );
  }

  if (activeForm === "offer" && session) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <IdentityVerificationGate session={session} onVerified={() => setIdentityVerified(true)} />
        <form onSubmit={handleSubmitOffer} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Your offer amount (₦)</label>
            <CurrencyInput value={amount} onChange={setAmount} placeholder="e.g. 42,000,000" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Note to the owner (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
            />
          </div>
          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit offer"}
          </button>
        </form>
      </div>
    );
  }

  if (activeForm === "inspection" && session) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <InspectionBookingForm
          propertyId={property.id}
          propertyLocation={`${property.location_area || ""} ${property.location_lga || ""} ${property.location_state || ""}`}
          session={session}
          onSuccess={() => setInspectionSuccess(true)}
        />
      </div>
    );
  }

  if (activeForm === "rentalApplication" && session) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <RentalApplicationForm
          propertyId={property.id}
          session={session}
          onSuccess={() => setRentalApplicationSuccess(true)}
        />
      </div>
    );
  }

  if (activeForm === "shortlet" && session && property.price_per_night) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <ShortletBookingForm
          propertyId={property.id}
          pricePerNight={property.price_per_night}
          session={session}
          onSuccess={() => setShortletSuccess(true)}
        />
      </div>
    );
  }

  // Default state: show the real, relevant actions for this property's
  // purpose. Making an offer only makes sense for a sale property;
  // booking an inspection is genuinely useful for every property type;
  // starting a rental application only makes sense for rent/lease/hire;
  // shortlet booking is its own, entirely separate purpose.
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
      {property.purpose === "sale" && (
        <button
          onClick={() => requireLoginThen(() => setActiveForm("offer"))}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold"
        >
          Make an offer
        </button>
      )}
      {property.purpose === "rent_to_own" && (
        rentToOwnSuccess ? (
          <p className="text-sm text-green-600 font-semibold text-center py-2">✓ Request sent — the owner will review and approve it.</p>
        ) : (
          <>
            <button
              onClick={() => requireLoginThen(handleRequestRentToOwn)}
              disabled={rentToOwnSubmitting}
              className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
            >
              {rentToOwnSubmitting ? "Sending request..." : "Request Rent to Own / Mortgage"}
            </button>
            {error && <p className="text-xs text-chs-red text-center">{error}</p>}
          </>
        )
      )}
      {property.purpose === "shortlet" && property.price_per_night && (
        <button
          onClick={() => requireLoginThen(() => setActiveForm("shortlet"))}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold"
        >
          Book now
        </button>
      )}
      {property.purpose !== "sale" && property.purpose !== "shortlet" && (
        <button
          onClick={() => requireLoginThen(() => setActiveForm("rentalApplication"))}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold"
        >
          Start rental application
        </button>
      )}
      {property.purpose !== "shortlet" && (
        <button
          onClick={() => requireLoginThen(() => setActiveForm("inspection"))}
          className="w-full py-3 rounded-full bg-chs-charcoal text-white text-sm font-semibold"
        >
          Book inspection
        </button>
      )}
    </div>
  );
}
