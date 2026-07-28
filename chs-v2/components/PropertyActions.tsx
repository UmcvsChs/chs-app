"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Property } from "@/types/property";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import CurrencyInput from "./CurrencyInput";
import InspectionBookingForm from "./InspectionBookingForm";
import RentalApplicationForm from "./RentalApplicationForm";
import ShortletBookingForm from "./ShortletBookingForm";

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

  async function handleSubmitOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || amount < 1000) {
      setError("Please enter a valid offer amount.");
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
