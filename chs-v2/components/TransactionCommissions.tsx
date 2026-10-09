"use client";

import { embeddedOne } from "@/lib/embedded";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

interface Commission {
  id: string;
  transaction_type: string;
  payer_role: string;
  base_amount: number;
  commission_percentage: number;
  commission_amount: number;
  tenancy_id: string | null;
  properties: { title: string }[] | null;
}

// The real, corrected, two-sided commission display — usable
// anywhere a real payer (buyer, seller, tenant, or landlord) needs to
// see and settle what they owe. One shared component instead of
// duplicating this across every dashboard it's relevant to.
//
// Real, critical fix following a direct, serious client report with
// real evidence: a tenant's very first rental commission is not a
// standalone fee the way a sale's is — it exists specifically to be
// paid together with the real rent itself, through pay_rent, which
// combines both into one real payment and actually creates the real
// rent record and pays the landlord. pay_transaction_commission was
// never built to do any of that — it only ever settles a standalone
// fee. Using it here, for a first rental commission, let a tenant pay
// CHS's own share while the real rent — and the landlord's money —
// never moved at all. Rental commissions from a genuine renewal
// (transaction_type = "rental" with no tenancy_id, or landlord-side
// renewal commissions) still correctly use the standalone path, since
// those are real, separate fees, not bundled with a rent payment.
export default function TransactionCommissions({ session }: { session: Session }) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadCommissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCommissions() {
    const { data } = await supabase
      .from("transaction_commissions")
      .select("id, transaction_type, payer_role, base_amount, commission_percentage, commission_amount, tenancy_id, properties(title)")
      .eq("payer_id", session.user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setCommissions((data as unknown as Commission[]) || []);
  }

  async function handlePay(c: Commission) {
    setPayingId(c.id);
    setMessage(null);
    const isFirstRentalPayment = c.transaction_type === "rental" && c.payer_role === "tenant" && c.tenancy_id;
    const { error } = isFirstRentalPayment
      ? await supabase.rpc("pay_rent", { p_tenancy_id: c.tenancy_id, p_wallet_source: "main" })
      : await supabase.rpc("pay_transaction_commission", { p_commission_id: c.id });
    setPayingId(null);
    if (error) {
      setMessage(error.message.includes("insufficient_balance") ? "Insufficient wallet balance for the real total due." : error.message);
      return;
    }
    setMessage(isFirstRentalPayment ? "✓ Rent and commission paid together — your tenancy is fully active." : "✓ Commission paid.");
    loadCommissions();
  }

  if (commissions.length === 0) return null;

  return (
    <div className="px-4 pb-4">
      <p className="text-xs font-bold text-chs-charcoal mb-2">💰 Commission Due</p>
      {message && <p className="text-[10px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5 mb-2">{message}</p>}
      <div className="space-y-2">
        {commissions.map((c) => {
          const isFirstRentalPayment = c.transaction_type === "rental" && c.payer_role === "tenant" && c.tenancy_id;
          const realTotal = isFirstRentalPayment ? c.base_amount + c.commission_amount : c.commission_amount;
          return (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-semibold text-chs-charcoal">{embeddedOne(c.properties)?.title || "Property"}</p>
              {isFirstRentalPayment ? (
                <p className="text-[10px] text-gray-400">
                  Your first year&apos;s rent ({formatNaira(c.base_amount)}) plus your real CHS commission ({c.commission_percentage}% — {formatNaira(c.commission_amount)}), paid together
                </p>
              ) : (
                <p className="text-[10px] text-gray-400">
                  Your share as the {c.payer_role} — {c.commission_percentage}% of {formatNaira(c.base_amount)}
                  {c.transaction_type === "rental" ? " annual rent" : " sale price"}
                </p>
              )}
              <div className="flex justify-between items-center mt-1.5">
                <p className="text-sm font-bold text-chs-red">{formatNaira(realTotal)}</p>
                <button onClick={() => handlePay(c)} disabled={payingId === c.id}
                  className="px-3 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                  {payingId === c.id ? "Paying..." : "Pay from wallet"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
