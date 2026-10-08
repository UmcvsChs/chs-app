"use client";

import { Req, RequiredLegend } from "@/components/FormMarks";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InfoTip from "./InfoTip";
import { Property } from "@/types/property";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import CurrencyInput from "./CurrencyInput";
import InspectionBookingForm from "./InspectionBookingForm";
import RentalApplicationForm from "./RentalApplicationForm";
import ShortletBookingForm from "./ShortletBookingForm";
import HireBookingForm from "./HireBookingForm";
import BookingRequestSent from "./BookingRequestSent";
import { BookingRequestResult } from "@/lib/bookingLane";
import IdentityVerificationGate from "./IdentityVerificationGate";
import VerifiedOnly from "./VerifiedOnly";
import CompleteDetailsPrompt from "./CompleteDetailsPrompt";
import OfferMessageThread from "./OfferMessageThread";
import RefundPolicyNotice from "./RefundPolicyNotice";
import ValidatedInput from "./ValidatedInput";
import { validatePhone, validateFullName } from "@/lib/validators";

type ActiveForm = "none" | "offer" | "inspection" | "rentalApplication" | "shortlet" | "hire" | "rentToOwn";

export default function PropertyActions({ property, isOwner }: { property: Property; isOwner?: boolean }) {
  const router = useRouter();
  const { session, loading } = useAuth();
  // Real, direct fix for a genuine, serious, confirmed gap: this
  // component previously showed the exact same "Make an offer" buyer
  // flow to literally everyone, including the property's own owner —
  // there was no real check anywhere for "is the current viewer the
  // person who owns this listing." An owner following a real
  // notification about their own negotiation landed on a page telling
  // them to make an offer on their own property, with no way to see
  // or respond to what actually needed their decision.
  const [finalizeAmount, setFinalizeAmount] = useState<number | "">("");
  const [finalizeNote, setFinalizeNote] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeSuccess, setFinalizeSuccess] = useState(false);
  async function handleFinalizeAgreement(offerId: string) {
    if (!finalizeAmount) return;
    setFinalizing(true);
    const { error } = await supabase.rpc("finalize_negotiated_agreement", {
      p_offer_id: offerId, p_final_amount: finalizeAmount, p_note: finalizeNote.trim() || null,
    });
    setFinalizing(false);
    if (!error) setFinalizeSuccess(true);
  }

  const [ownerOffers, setOwnerOffers] = useState<{
    id: string; amount: number; status: string; buyer_full_name: string | null; note: string | null;
  }[]>([]);
  // The owner sees the buyer as "Alex P." only; CHS holds the full name and phone.
  const [ownerRentToOwnRequests, setOwnerRentToOwnRequests] = useState<{
    id: string; monthly_amount: number; status: string; display_name: string; occupation: string | null; source_of_funds: string | null; verified: boolean;
  }[]>([]);
  async function handleApproveRentToOwn(id: string) {
    const { error } = await supabase.rpc("approve_rent_to_own_request", { p_agreement_id: id });
    if (!error) setOwnerRentToOwnRequests((prev) => prev.filter((r) => r.id !== id));
  }
  useEffect(() => {
    if (isOwner) {
      supabase.from("owner_offers").select("id, amount, status, buyer_full_name, note")
        .eq("property_id", property.id)
        .in("status", ["awaiting_owner_decision", "owner_decided_pending_relay", "rejected"])
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setOwnerOffers(data || []);
          const active = (data || []).find((o) => o.status !== "rejected") || data?.[0];
          if (active) setFinalizeAmount(active.amount);
        });
      if (property.purpose === "rent_to_own") {
        supabase.rpc("get_owner_rto_requests", { p_property_id: property.id })
          .then(({ data }) => setOwnerRentToOwnRequests(((data as typeof ownerRentToOwnRequests) || []).filter((r) => r.status === "requested")));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, property.id]);

  const [activeForm, setActiveForm] = useState<ActiveForm>("none");
  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [buyerFullName, setBuyerFullName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerOccupation, setBuyerOccupation] = useState("");
  const [buyerSourceOfFunds, setBuyerSourceOfFunds] = useState("");

  // Real, direct fix, per standing instruction: the same real draft
  // mechanism just built for the rental application form, applied
  // here too — every field a buyer types into a real offer is saved
  // to this browser as they type, keyed to this property, and
  // restored automatically if something interrupts them.
  const offerDraftKey = `chs_offer_draft_${property.id}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(offerDraftKey);
      if (saved) {
        const d = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (d.amount) setAmount(d.amount);
        if (d.note) setNote(d.note);
        if (d.buyerFullName) setBuyerFullName(d.buyerFullName);
        if (d.buyerPhone) setBuyerPhone(d.buyerPhone);
        if (d.buyerOccupation) setBuyerOccupation(d.buyerOccupation);
        if (d.buyerSourceOfFunds) setBuyerSourceOfFunds(d.buyerSourceOfFunds);
      }
    } catch { /* a corrupted or blocked draft should never break the real form */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(offerDraftKey, JSON.stringify({ amount, note, buyerFullName, buyerPhone, buyerOccupation, buyerSourceOfFunds }));
    } catch { /* private-browsing or full storage should never break typing */ }
  }, [offerDraftKey, amount, note, buyerFullName, buyerPhone, buyerOccupation, buyerSourceOfFunds]);

  // Real, direct fix: a buyer returning here after their identity was
  // approved previously landed on a blank form, having to retype
  // everything they'd already entered before submitting for
  // verification. Their real, in-progress answers are now saved
  // alongside that submission and restored here automatically.
  useEffect(() => {
    supabase.from("buyer_id_verifications").select("draft_offer")
      .eq("return_property_id", property.id).eq("status", "approved")
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        const draft = data?.draft_offer as Record<string, string> | undefined;
        if (draft) {
          if (draft.buyer_full_name) setBuyerFullName(draft.buyer_full_name);
          if (draft.buyer_phone) setBuyerPhone(draft.buyer_phone);
          if (draft.buyer_occupation) setBuyerOccupation(draft.buyer_occupation);
          if (draft.buyer_source_of_funds) setBuyerSourceOfFunds(draft.buyer_source_of_funds);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.id]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerSuccess, setOfferSuccess] = useState(false);
  const [inspectionSuccess, setInspectionSuccess] = useState(false);
  const [rentalApplicationSuccess, setRentalApplicationSuccess] = useState(false);
  const [shortletSuccess, setShortletSuccess] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingRequestResult | null>(null);
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
  const [latestReceiptReference, setLatestReceiptReference] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [myPaidOffer, setMyPaidOffer] = useState<{ id: string; document_deadline: string; legal_transfer_confirmed: boolean } | null>(null);
  const [saleDocuments, setSaleDocuments] = useState<{ id: string; document_type: string; file_url: string; verification_status: string }[]>([]);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<"none" | "requested" | "dispatched">("none");
  const [requestingDispatch, setRequestingDispatch] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [preferredMethod, setPreferredMethod] = useState("courier");
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [confirmingDocuments, setConfirmingDocuments] = useState(false);
  const [documentsConfirmed, setDocumentsConfirmed] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState(false);
  // Real, direct client request (rebuilt after the prior photo-tour-
  // based version of this gate was superseded by the real room-video
  // system): if the owner has uploaded at least one real room video,
  // a requester must see and acknowledge that free alternative before
  // booking a paid physical inspection.
  const [hasRoomVideos, setHasRoomVideos] = useState(false);

  useEffect(() => {
    supabase
      .from("property_videos")
      .select("id", { count: "exact", head: true })
      .eq("property_id", property.id)
      .then(({ count }) => setHasRoomVideos(!!count && count > 0));
  }, [property.id]);

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
            .eq("property_id", property.id).eq("verification_status", "verified")
            .then(({ data: docs }) => setSaleDocuments(docs || []));
          supabase.from("document_dispatch_requests").select("status").eq("offer_id", data.id).maybeSingle().then(({ data: dispatch }) => {
            setDispatchStatus((dispatch?.status as "requested" | "dispatched") || "none");
          });
        }
      });
  }, [session, property.id, property.purpose]);

  async function handleRequestDispatch() {
    if (!myPaidOffer) return;
    setDispatchError(null);
    if (!deliveryAddress.trim() || !deliveryPhone.trim()) {
      setDispatchError("Please provide a real delivery address and a real contact phone number.");
      return;
    }
    const deliveryPhoneCheck = validatePhone(deliveryPhone, { international: true });
    if (!deliveryPhoneCheck.valid) {
      setDispatchError(`Contact phone number: ${deliveryPhoneCheck.message}`);
      return;
    }
    setRequestingDispatch(true);
    const { error } = await supabase.rpc("request_document_dispatch", {
      p_offer_id: myPaidOffer.id,
      p_delivery_address: deliveryAddress.trim(),
      p_delivery_phone: validatePhone(deliveryPhone, { international: true }).value,
      p_preferred_method: preferredMethod,
      p_delivery_note: deliveryNote.trim() || null,
    });
    setRequestingDispatch(false);
    if (error) {
      setDispatchError(error.message);
      return;
    }
    setDispatchStatus("requested");
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
    // Real, direct fix per a direct client report: paying used to
    // just show a dead-end "success" message and stop there — the
    // real receipt, the real document-request tools, and the real
    // refund-protection countdown all already existed, but only ever
    // appeared after a manual page refresh. Now populated immediately,
    // the instant payment succeeds, since none of this data needs to
    // be "generated" — it already exists the moment the real payment
    // clears.
    const [{ data: offerData }, { data: txData }] = await Promise.all([
      supabase.from("offers").select("id, document_deadline, legal_transfer_confirmed").eq("id", myAcceptedOffer.id).single(),
      supabase.from("wallet_transactions").select("reference").eq("user_id", session!.user.id).or("reference.ilike.SALEPAY-%,reference.ilike.AGENTSALE-%").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setMyPaidOffer(offerData);
    setDeadlinePassed(false);
    setDispatchStatus("none");
    setLatestReceiptReference(txData?.reference || null);
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
      const [{ data: offerData }, { data: txData }] = await Promise.all([
        supabase.from("offers").select("id, document_deadline, legal_transfer_confirmed").eq("id", myAcceptedOffer.id).single(),
        supabase.from("wallet_transactions").select("reference").eq("user_id", session!.user.id).ilike("reference", "INSTALL-%").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setMyPaidOffer(offerData);
      setDeadlinePassed(false);
      setDispatchStatus("none");
      setLatestReceiptReference(txData?.reference || null);
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

  // Buyer details are collected FIRST, then the request is sent to CHS.
  const [rto, setRto] = useState({ name: "", phone: "", occupation: "", funds: "", address: "" });
  useEffect(() => {
    if (activeForm !== "rentToOwn" || !session) return;
    supabase.from("profiles").select("full_name, phone").eq("id", session.user.id).single().then(({ data }) => {
      if (!data) return;
      setRto((cur) => ({ ...cur, name: cur.name || data.full_name || "", phone: cur.phone || data.phone || "" }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeForm]);

  async function handleRequestRentToOwn() {
    setError(null);
    const nameCheck = validateFullName(rto.name, "full name");
    if (!nameCheck.valid) { setError(nameCheck.message); return; }
    const phoneCheck = validatePhone(rto.phone, { international: true });
    if (!phoneCheck.valid) { setError(`Your phone number: ${phoneCheck.message}`); return; }
    if (!rto.occupation.trim() || !rto.funds.trim() || rto.address.trim().length < 5) {
      setError("Please fill in every field marked with a red star before sending.");
      return;
    }
    setRentToOwnSubmitting(true);
    const { error: rpcError } = await supabase.rpc("request_rent_to_own", {
      p_property_id: property.id, p_full_name: rto.name.trim(), p_phone: phoneCheck.value,
      p_occupation: rto.occupation.trim(), p_source_of_funds: rto.funds.trim(), p_address: rto.address.trim(),
    });
    setRentToOwnSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setRentToOwnSuccess(true);
    setActiveForm("none");
  }

  async function handleSubmitOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || amount < 1000) {
      setError("Please enter a valid offer amount.");
      return;
    }
    const buyerNameCheck = validateFullName(buyerFullName, "full name — the seller needs to know who is making this offer");
    if (!buyerNameCheck.valid) {
      setError(buyerNameCheck.message);
      return;
    }
    const buyerPhoneCheck = validatePhone(buyerPhone, { international: true });
    if (!buyerPhoneCheck.valid) {
      setError(`Your phone number: ${buyerPhoneCheck.message}`);
      return;
    }
    if (!buyerOccupation.trim() || !buyerSourceOfFunds.trim()) {
      setError("Please tell the seller your occupation and the real source of funds for this purchase.");
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
      buyer_full_name: buyerFullName.trim(),
      buyer_phone: validatePhone(buyerPhone, { international: true }).value,
      buyer_occupation: buyerOccupation.trim(),
      buyer_source_of_funds: buyerSourceOfFunds.trim(),
    });

    if (insertError) {
      // Real, direct fix, per standing instruction: the same real
      // fix just made to the rental application form, applied here
      // too — the actual error was being discarded for anything
      // that wasn't a contact-info violation, including a session
      // that quietly expired mid-form.
      const authLikely = insertError.message.toLowerCase().includes("jwt") || insertError.message.toLowerCase().includes("row-level security");
      setError(insertError.message.includes("contact info") || insertError.message.includes("phone number") || insertError.message.includes("email")
        ? insertError.message
        : authLikely
          ? "Your session appears to have expired. Please log in again — everything you've typed here has been saved and will be waiting for you."
          : `Could not submit your offer: ${insertError.message}`);
      setSubmitting(false);
      return;
    }
    try { localStorage.removeItem(`chs_offer_draft_${property.id}`); } catch { /* real success should never be blocked by storage cleanup */ }

    setOfferSuccess(true);
    setSubmitting(false);
  }

  if (myPaidOffer) {
    if (refundSuccess) {
      return (
        <div className="bg-white rounded-xl border-2 border-green-600 p-4 text-center">
          <p className="text-sm font-bold text-green-700">✓ Refund issued — your payment is back in your wallet, with CHS&apos;s commission returned in full, less only the small real bank processing fee. The exact amount is in your wallet history and notifications.</p>
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
        <p className="text-sm font-bold text-chs-charcoal mb-1">
          {paymentSuccess ? "🎉 Payment successful — this property is now yours!" : "✓ Payment complete — this property is now yours!"}
        </p>
        {latestReceiptReference && (
          <Link href={`/receipt/${latestReceiptReference}`} className="block bg-chs-red text-white text-center text-xs font-semibold py-2 rounded-full mb-3">
            📄 Click here to view your real receipt
          </Link>
        )}
        <p className="text-xs text-gray-500 mb-3">
          Real documents are due to you by {new Date(myPaidOffer.document_deadline).toLocaleDateString()}. If they haven&apos;t arrived by then, you can request a refund below — your full payment back, including CHS&apos;s commission, less only a small real bank processing fee (never more than ₦2,000).
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
          <div className="bg-[var(--zone-card)] rounded-lg p-3 mb-2">
            <p className="text-xs font-bold text-chs-charcoal mb-1">📮 Tell the seller how to get your real hard copies to you</p>
            <p className="text-[10px] text-gray-500 mb-2">The seller will see exactly what you enter here, so they know precisely how and where to send your real documents.</p>
            <RequiredLegend className="mb-1" />
            <label className="text-[10px] font-semibold text-gray-600">Your real delivery address <Req /></label>
            <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Where should the documents be delivered?" className="w-full mt-1 mb-1.5 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
            <label className="text-[10px] font-semibold text-gray-600">Your real contact phone number <Req /></label>
            <ValidatedInput kind="phoneIntl" value={deliveryPhone} onChange={setDeliveryPhone}
              placeholder="A real number CHS can reach you on" className="w-full mt-1 mb-1.5 px-2 py-1.5 rounded-lg text-[11px]" />
            <p className="text-[10px] text-gray-500 mb-1.5">Kept by CHS to coordinate the hand-over. The seller never sees your phone number.</p>
            <label className="text-[10px] font-semibold text-gray-600">Preferred delivery method <Req /></label>
            <select value={preferredMethod} onChange={(e) => setPreferredMethod(e.target.value)}
              className="w-full mt-1 mb-1.5 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] bg-white">
              <option value="courier">Courier / dispatch rider</option>
              <option value="post">Postal service</option>
              <option value="hand_delivery">Hand delivery — I&apos;ll meet the seller</option>
              <option value="pickup">I&apos;ll pick it up myself</option>
            </select>
            <label className="text-[10px] font-semibold text-gray-600">Anything else the seller should know (optional)</label>
            <textarea placeholder="e.g. best time to deliver, a landmark near your address"
              value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)}
              rows={2} className="w-full mt-1 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
            {dispatchError && <p className="text-[10px] text-chs-red bg-white rounded-lg px-2 py-1.5 mt-1.5">{dispatchError}</p>}
            <button onClick={handleRequestDispatch} disabled={requestingDispatch}
              className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold mt-2 disabled:opacity-50">
              {requestingDispatch ? "Sending request..." : "Request my real documents"}
            </button>
          </div>
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

  if (myAcceptedOffer && breakdown && !myPaidOffer) {
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
            <p className="text-[10px] text-gray-500 mb-3">After your final installment, your funds are held safely by CHS. We act on your behalf to ensure every real legal document is delivered within 14 working days — if not, you can request a refund: your full payment back, including CHS&apos;s commission, less only a small real bank processing fee (never more than ₦2,000).</p>
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
                <div className="flex justify-between text-xs"><span className="text-gray-500">Platform commission ({breakdown.buyer_pct}%)<InfoTip text="CHS's real fee for verifying this property's documents, holding your payment safely in escrow, and coordinating the actual legal handover — not an extra profit margin added by the seller." /></span><span className="font-semibold">{formatNaira(breakdown.buyer_commission)}</span></div>
              )}
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5 mt-1"><span className="font-bold text-chs-charcoal">Total due</span><span className="font-bold text-chs-red">{formatNaira(breakdown.buyer_total)}</span></div>
            </div>
            <p className="text-[10px] text-gray-500 mb-2">
              After payment, your funds are held safely by CHS. We act on your behalf to ensure every real legal document is delivered to you within 14 working days. If they haven&apos;t arrived by then, you can request a refund and cancel this deal, right from your dashboard.
            </p>
            <RefundPolicyNotice className="mb-3" />
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
        <p className="text-sm font-semibold text-chs-charcoal mb-1">✓ Inspection requested — nothing has been charged</p>
        <p className="text-xs text-gray-500">
          CHS will assign your agent and confirm the final transport cost. You will be asked to pay it from your CHS Wallet — the whole cost is yours, and you pay it nowhere else.
        </p>
        <a href="/my-inspections" className="inline-block mt-2 text-xs font-semibold text-chs-red underline">Track it in My Inspections →</a>
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
    // A request was sent — not a confirmed booking. Say exactly what happens next.
    return <BookingRequestSent result={bookingResult} />;
  }

  if (activeForm === "offer" && session) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <IdentityVerificationGate session={session} onVerified={() => setIdentityVerified(true)}
          propertyId={property.id}
          draftOffer={{ buyer_full_name: buyerFullName, buyer_phone: buyerPhone, buyer_occupation: buyerOccupation, buyer_source_of_funds: buyerSourceOfFunds }} />
        <CompleteDetailsPrompt session={session} />
        <form onSubmit={handleSubmitOffer} className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase">About you</p>
          <p className="text-[10px] text-gray-400 -mt-2">CHS reviews all of this. The seller sees your name, occupation and source of funds — never your phone number.</p>
          <div>
            <RequiredLegend className="mb-1.5" />
            <label className="text-xs font-semibold text-gray-600">Your full name <Req /></label>
            <input type="text" value={buyerFullName} onChange={(e) => setBuyerFullName(e.target.value)}
              placeholder="Your real, full legal name" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Your phone number <Req /></label>
            <ValidatedInput kind="phoneIntl" value={buyerPhone} onChange={setBuyerPhone}
              placeholder="08XXXXXXXXX" className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Your occupation <Req /></label>
            <input type="text" value={buyerOccupation} onChange={(e) => setBuyerOccupation(e.target.value)}
              placeholder="e.g. Business owner, Civil servant" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Source of funds for this purchase <Req /></label>
            <input type="text" value={buyerSourceOfFunds} onChange={(e) => setBuyerSourceOfFunds(e.target.value)}
              placeholder="e.g. Personal savings, Business proceeds, Loan" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          <p className="text-[10px] font-bold text-gray-400 uppercase pt-1">Your offer</p>
          <div>
            <label className="text-xs font-semibold text-gray-600">Your offer amount (₦) <Req /></label>
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
        <VerifiedOnly session={session} propertyId={property.id}>
          <InspectionBookingForm
          propertyId={property.id}
          propertyLocation={`${property.location_area || ""} ${property.location_lga || ""} ${property.location_state || ""}`}
          session={session}
          hasRoomVideos={hasRoomVideos}
          onSuccess={() => setInspectionSuccess(true)}
        />
        </VerifiedOnly>
      </div>
    );
  }

  // Rent-to-own was a single tap with no identity check at all. It now
  // sits behind the same verification gate as every other commitment;
  // once verified, the person confirms and sends the request.
  if (activeForm === "rentToOwn" && session) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <VerifiedOnly session={session} propertyId={property.id}>
          <p className="text-sm font-semibold text-chs-charcoal">Request Mortgage (Rent to Own)</p>
          <p className="text-xs text-gray-500">Fill in your details first. CHS checks them and passes your request to the owner, who sees only your first name and the first letter of your last name. Nothing is charged now.</p>
          <RequiredLegend />
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-gray-600">Full name <Req /></label>
            <input value={rto.name} onChange={(e) => setRto({ ...rto, name: e.target.value })} placeholder="As shown on your ID" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            <label className="text-[10px] font-semibold text-gray-600">Phone number <Req /></label>
            <ValidatedInput kind="phoneIntl" value={rto.phone} onChange={(v) => setRto({ ...rto, phone: v })} placeholder="08XXXXXXXXX" className="w-full px-3 py-2.5 rounded-lg text-sm" />
            <p className="text-[10px] text-gray-500">Kept by CHS. The owner never sees it.</p>
            <label className="text-[10px] font-semibold text-gray-600">Occupation <Req /></label>
            <input value={rto.occupation} onChange={(e) => setRto({ ...rto, occupation: e.target.value })} placeholder="e.g. Civil servant, trader, engineer" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            <label className="text-[10px] font-semibold text-gray-600">Source of funds <Req /></label>
            <input value={rto.funds} onChange={(e) => setRto({ ...rto, funds: e.target.value })} placeholder="e.g. Salary, business income, savings" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            <label className="text-[10px] font-semibold text-gray-600">Your home address <Req /></label>
            <input value={rto.address} onChange={(e) => setRto({ ...rto, address: e.target.value })} placeholder="Where you live now" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>
          {error && <p className="text-xs text-chs-red">{error}</p>}
          <button
            onClick={handleRequestRentToOwn}
            disabled={rentToOwnSubmitting}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
          >
            {rentToOwnSubmitting ? "Sending request..." : "Send my request"}
          </button>
        </VerifiedOnly>
      </div>
    );
  }

  if (activeForm === "rentalApplication" && session) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <VerifiedOnly session={session} propertyId={property.id}>
          <RentalApplicationForm
          propertyId={property.id}
          session={session}
          onSuccess={() => setRentalApplicationSuccess(true)}
        />
        </VerifiedOnly>
      </div>
    );
  }

  if (activeForm === "shortlet" && session) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <VerifiedOnly session={session} propertyId={property.id}>
          <ShortletBookingForm
          propertyId={property.id}
          pricePerNight={property.price_per_night || property.price}
          session={session}
          onSuccess={(r) => { setBookingResult(r); setShortletSuccess(true); }}
        />
        </VerifiedOnly>
      </div>
    );
  }

  if (activeForm === "hire" && session && property.price) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <VerifiedOnly session={session} propertyId={property.id}>
          <HireBookingForm
          propertyId={property.id}
          pricePerDay={property.price}
          hireCategoryLabel={property.property_type || "venue"}
          session={session}
          onSuccess={(r) => { setBookingResult(r); setShortletSuccess(true); }}
        />
        </VerifiedOnly>
      </div>
    );
  }

  // Real, direct fix — an early, genuinely separate view for the
  // property's own owner, instead of falling through to the same
  // buyer-facing "Make an offer" flow everyone else sees.
  if (isOwner) {
    const activeOffer = ownerOffers.find((o) => o.status !== "rejected") || ownerOffers[0];
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <p className="text-sm font-bold text-chs-charcoal">🏠 This is your own listing</p>
        <Link href={`/edit-listing/${property.id}`} className="block text-center py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold">
          Edit this listing
        </Link>
        {activeOffer ? (
          <div className="bg-[var(--zone-card)] rounded-lg p-3 mt-2">
            <p className="text-xs font-bold text-chs-charcoal mb-1">
              {activeOffer.status === "rejected" ? "A real negotiation is ongoing below" : "A real offer needs your decision"}
            </p>
            <p className="text-sm font-semibold text-chs-red">{formatNaira(activeOffer.amount)}</p>
            <p className="text-xs text-gray-500 mb-2">from {activeOffer.buyer_full_name || "a real buyer"}</p>
            {activeOffer.status === "awaiting_owner_decision" && (
              <p className="text-[10px] text-gray-500 mb-2">Go to your dashboard&apos;s Recent Property Quotation to accept or decline this real offer.</p>
            )}
            {session && (
              <OfferMessageThread offerId={activeOffer.id} viewerRole="seller" viewerId={session.user.id} />
            )}
            {/* Real, new panel per direct, specific client design: a
                real button that stays beside the negotiation
                conversation no matter how long it runs — whenever the
                seller is genuinely okay with wherever the price has
                landed, this is the one real action that turns talk
                into a payable deal, with an optional note for any real
                condition (a deadline, a term) the seller wants the
                buyer to see alongside it. */}
            {activeOffer.status === "rejected" && (
              finalizeSuccess ? (
                <p className="text-xs text-green-700 font-semibold text-center py-2 mt-2">✓ Buyer alerted — go-ahead sent</p>
              ) : (
                <div className="bg-white rounded-lg border-2 border-chs-red p-3 mt-2">
                  <p className="text-[10px] font-bold text-chs-charcoal mb-1.5">
                    Whenever you&apos;re okay with the price above, confirm it here to alert the buyer to pay:
                  </p>
                  <input type="number" value={finalizeAmount} onChange={(e) => setFinalizeAmount(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2" placeholder="Final agreed amount" />
                  <textarea value={finalizeNote} onChange={(e) => setFinalizeNote(e.target.value)}
                    placeholder="Optional note — e.g. this offer is valid for 7 days" rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs mb-2" />
                  <button onClick={() => handleFinalizeAgreement(activeOffer.id)} disabled={finalizing || !finalizeAmount}
                    className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                    {finalizing ? "Sending…" : "✓ I agree — alert buyer to pay"}
                  </button>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">No real, active offers on this listing right now.</p>
        )}
        {ownerRentToOwnRequests.map((r) => (
          <div key={r.id} className="bg-[var(--zone-card)] rounded-lg p-3 mt-2">
            <p className="text-xs font-bold text-chs-charcoal mb-1">🏠 A real Rent-to-Own request needs your approval</p>
            <p className="text-sm font-semibold text-chs-red">{formatNaira(r.monthly_amount)}/month</p>
            <p className="text-xs text-gray-500 mb-2">from {r.display_name}{r.verified ? " · verified by CHS" : ""}{r.occupation ? ` · ${r.occupation}` : ""} · Ref RTO-{r.id.slice(0, 8)} (contact goes through CHS)</p>
            <button onClick={() => handleApproveRentToOwn(r.id)}
              className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold">
              Approve this request (CHS will confirm it to the buyer)
            </button>
          </div>
        ))}
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
          <p className="text-sm text-green-600 font-semibold text-center py-2">✓ Request sent — CHS will review it and pass it to the owner. Nothing has been charged.</p>
        ) : (
          <>
            <button
              onClick={() => requireLoginThen(() => setActiveForm("rentToOwn"))}
              disabled={rentToOwnSubmitting}
              className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
            >
              {rentToOwnSubmitting ? "Sending request..." : "Request Mortgage (Rent to Own)"}
            </button>
            {error && <p className="text-xs text-chs-red text-center">{error}</p>}
          </>
        )
      )}
      {property.purpose === "shortlet" && (property.price_per_night || property.price) && (
        <button
          onClick={() => requireLoginThen(() => setActiveForm("shortlet"))}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold"
        >
          Book now
        </button>
      )}
      {property.purpose === "hire" && property.hire_category && property.price && (
        <button
          onClick={() => requireLoginThen(() => setActiveForm("hire"))}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold"
        >
          Book now
        </button>
      )}
      {property.purpose !== "sale" && property.purpose !== "shortlet" && !(property.purpose === "hire" && property.hire_category) && (
        <button
          onClick={() => requireLoginThen(() => setActiveForm("rentalApplication"))}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold"
        >
          Start rental application
        </button>
      )}
      {property.purpose !== "shortlet" && !(property.purpose === "hire" && property.hire_category) && (
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
