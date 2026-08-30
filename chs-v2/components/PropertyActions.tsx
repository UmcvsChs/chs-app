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
  const [myAcceptedOffer, setMyAcceptedOffer] = useState<{ id: string } | null>(null);
  const [breakdown, setBreakdown] = useState<{ offer_amount: number; buyer_pct: number; buyer_commission: number; buyer_total: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [myPaidOffer, setMyPaidOffer] = useState<{ id: string; document_deadline: string; legal_transfer_confirmed: boolean } | null>(null);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState(false);

  useEffect(() => {
    if (!session || property.purpose !== "sale") return;
    supabase
      .from("offers")
      .select("id")
      .eq("property_id", property.id)
      .eq("buyer_id", session.user.id)
      .eq("status", "accepted")
      .eq("payment_status", "unpaid")
      .maybeSingle()
      .then(({ data }) => {
        setMyAcceptedOffer(data);
        if (data) {
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
        if (data) setDeadlinePassed(new Date(data.document_deadline).getTime() < Date.now());
      });
  }, [session, property.id, property.purpose]);

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
    const { error: rpcError } = await supabase.rpc("pay_for_property", { p_offer_id: myAcceptedOffer.id });
    setPaying(false);
    if (rpcError) {
      setPaymentError(rpcError.message);
      return;
    }
    setPaymentSuccess(true);
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
      setError("Could not submit your offer. Please try again.");
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
    return (
      <div className="bg-white rounded-xl border-2 border-chs-amber-dark p-4">
        <p className="text-sm font-bold text-chs-charcoal mb-1">✓ Payment complete — CHS is coordinating your legal document transfer</p>
        <p className="text-xs text-gray-500 mb-3">
          Real documents are due to you by {new Date(myPaidOffer.document_deadline).toLocaleDateString()}. If they haven&apos;t arrived by then, you can request a full refund below.
        </p>
        {refundError && <p className="text-xs text-chs-red mb-2">{refundError}</p>}
        <button onClick={handleRequestRefund} disabled={!deadlinePassed || requestingRefund}
          className="w-full py-2.5 rounded-full bg-chs-amber-dark text-white text-sm font-semibold disabled:opacity-40">
          {requestingRefund ? "Processing..." : deadlinePassed ? "Request refund & cancel this deal" : "Refund available after the deadline above"}
        </button>
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
      <div className="bg-white rounded-xl border-2 border-chs-red p-4">
        <p className="text-sm font-bold text-chs-charcoal mb-2">✓ Offer accepted — proceed to payment</p>
        <div className="bg-[var(--zone-card)] rounded-lg p-3 mb-3 space-y-1.5">
          <div className="flex justify-between text-xs"><span className="text-gray-500">Total accepted price</span><span className="font-semibold">{formatNaira(breakdown.offer_amount)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">Platform commission ({breakdown.buyer_pct}%)</span><span className="font-semibold">{formatNaira(breakdown.buyer_commission)}</span></div>
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
      </div>
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
