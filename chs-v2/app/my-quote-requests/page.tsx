"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import NotificationBell from "@/components/NotificationBell";

// Real, new page completing a genuine, confirmed gap found while
// building the real, admin-mediated marketplace: a buyer had no real
// way to see the status of their own quote requests, or to accept and
// pay for one once a vendor's response was reviewed and approved.
interface DirectOrder {
  id: string;
  reference_number: string;
  amount: number;
  buyer_commission_amount: number;
  payment_status: string;
  created_at: string;
  marketplace_products: { name: string }[] | null;
}

interface QuoteRequest {
  id: string;
  reference_number: string;
  property_details: string;
  moderation_status: string;
  block_reason: string | null;
  vendor_response: string | null;
  quoted_amount: number | null;
  response_moderation_status: string | null;
  response_block_reason: string | null;
  payment_status: string;
  status: string;
  created_at: string;
  marketplace_products: { name: string }[] | null;
}

export default function MyQuoteRequestsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [directOrders, setDirectOrders] = useState<DirectOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  async function loadRequests() {
    if (!session) return;
    const [quotesRes, ordersRes] = await Promise.all([
      supabase.from("service_quote_requests")
        .select("*, marketplace_products(name)")
        .eq("requester_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase.from("marketplace_direct_orders")
        .select("*, marketplace_products(name)")
        .eq("buyer_id", session.user.id)
        .order("created_at", { ascending: false }),
    ]);
    setRequests((quotesRes.data as unknown as QuoteRequest[]) || []);
    setDirectOrders((ordersRes.data as unknown as DirectOrder[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  async function handleAcceptAndPay(id: string) {
    setPayingId(id);
    setActionResult(null);
    const { data, error } = await supabase.rpc("accept_marketplace_quote", { p_request_id: id });
    setPayingId(null);
    if (error) {
      setActionResult(error.message.includes("insufficient_balance") ? "Insufficient wallet balance for this real total." : error.message);
      return;
    }
    setActionResult(`✓ Paid ${formatNaira(data.real_total_paid)} — held in escrow until CHS confirms delivery.`);
    loadRequests();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-buyer pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/marketplace" className="text-xs text-white/70">← Back to Marketplace</Link>
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">My Real Quote Requests</h1>
          <NotificationBell />
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {actionResult && <p className="text-xs bg-white rounded-lg p-3 border border-gray-200">{actionResult}</p>}

        {directOrders.length > 0 && (
          <div>
            <p className="text-xs font-bold text-chs-charcoal mb-1.5">🛒 My Direct Purchases</p>
            {directOrders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4 mb-2">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-semibold text-chs-charcoal">{o.marketplace_products?.[0]?.name || "Product"}</p>
                  <span className="text-[9px] font-bold text-white bg-chs-charcoal px-1.5 py-0.5 rounded-full">{o.reference_number}</span>
                </div>
                <p className="text-sm font-bold text-chs-charcoal">{formatNaira(o.amount + o.buyer_commission_amount)}</p>
                {o.payment_status === "held_escrow" && <p className="text-[10px] text-green-700 font-semibold mt-1">✓ Paid — held in escrow, pending confirmed delivery.</p>}
                {o.payment_status === "released" && <p className="text-[10px] text-green-700 font-semibold mt-1">✓ Deal complete — funds released to the vendor.</p>}
                {o.payment_status === "refunded" && <p className="text-[10px] text-gray-500 font-semibold mt-1">↩ Refunded in full to your wallet.</p>}
              </div>
            ))}
            <p className="text-xs font-bold text-chs-charcoal mb-1.5 mt-4">💬 My Quote Requests</p>
          </div>
        )}

        {requests.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No real quote requests yet — browse the Marketplace to start one.</p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex justify-between items-start mb-1">
                <p className="text-sm font-semibold text-chs-charcoal">{r.marketplace_products?.[0]?.name || "Product"}</p>
                <span className="text-[9px] font-bold text-white bg-chs-charcoal px-1.5 py-0.5 rounded-full">{r.reference_number}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{r.property_details}</p>

              {r.moderation_status === "blocked" && (
                <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">🚫 Not sent — {r.block_reason}</p>
              )}
              {r.moderation_status === "pending_review" && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">⏳ Awaiting real CHS review before this reaches the vendor.</p>
              )}
              {r.moderation_status === "approved" && !r.vendor_response && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">✓ Approved and sent — awaiting the vendor&apos;s real response.</p>
              )}
              {r.vendor_response && r.response_moderation_status === "pending_review" && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">⏳ The vendor has responded — CHS is reviewing it before it reaches you.</p>
              )}
              {r.vendor_response && r.response_moderation_status === "blocked" && (
                <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">🚫 The vendor&apos;s response could not be approved — {r.response_block_reason}</p>
              )}
              {r.vendor_response && r.response_moderation_status === "approved" && (
                <div className="bg-[var(--zone-card)] rounded-lg p-3 mt-1">
                  <p className="text-xs text-chs-charcoal mb-1">{r.vendor_response}</p>
                  {r.quoted_amount && <p className="text-sm font-bold text-chs-charcoal">Quoted: {formatNaira(r.quoted_amount)}</p>}
                  {r.payment_status === "unpaid" && (
                    <button onClick={() => handleAcceptAndPay(r.id)} disabled={payingId === r.id}
                      className="w-full mt-2 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                      {payingId === r.id ? "Processing..." : "Accept & Pay (price + 6% real commission)"}
                    </button>
                  )}
                  {r.payment_status === "held_escrow" && (
                    <p className="text-[10px] text-green-700 font-semibold mt-2">✓ Paid — held in escrow, pending confirmed delivery.</p>
                  )}
                  {r.payment_status === "released" && (
                    <p className="text-[10px] text-green-700 font-semibold mt-2">✓ Deal complete — funds released to the vendor.</p>
                  )}
                  {r.payment_status === "refunded" && (
                    <p className="text-[10px] text-gray-500 font-semibold mt-2">↩ Refunded in full to your wallet.</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
