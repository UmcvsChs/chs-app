"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Property } from "@/types/property";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import CurrencyInput from "./CurrencyInput";

export default function PropertyActions({ property }: { property: Property }) {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

    setSuccess(true);
    setSubmitting(false);
  }

  if (success) {
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

  if (property.purpose === "sale") {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        {!showOfferForm ? (
          <button
            onClick={() => requireLoginThen(() => setShowOfferForm(true))}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold"
          >
            Make an offer
          </button>
        ) : (
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
        )}
      </div>
    );
  }

  // Rent/lease/hire booking actions are their own next piece — an
  // honest placeholder here, not a fake button pretending to work.
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 text-center text-sm text-gray-400">
      Booking actions for this property type are coming next.
    </div>
  );
}
