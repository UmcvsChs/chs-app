"use client";

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
  properties: { title: string }[] | null;
}

// The real, corrected, two-sided commission display — usable
// anywhere a real payer (buyer, seller, tenant, or landlord) needs to
// see and settle what they owe. One shared component instead of
// duplicating this across every dashboard it's relevant to.
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
      .select("id, transaction_type, payer_role, base_amount, commission_percentage, commission_amount, properties(title)")
      .eq("payer_id", session.user.id)
      .eq("status", "pending");
    setCommissions((data as unknown as Commission[]) || []);
  }

  async function handlePay(commissionId: string) {
    setPayingId(commissionId);
    setMessage(null);
    const { error } = await supabase.rpc("pay_transaction_commission", { p_commission_id: commissionId });
    setPayingId(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("✓ Commission paid.");
    loadCommissions();
  }

  if (commissions.length === 0) return null;

  return (
    <div className="px-4 pb-4">
      <p className="text-xs font-bold text-chs-charcoal mb-2">💰 Commission Due</p>
      {message && <p className="text-[10px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5 mb-2">{message}</p>}
      <div className="space-y-2">
        {commissions.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs font-semibold text-chs-charcoal">{c.properties?.[0]?.title || "Property"}</p>
            <p className="text-[10px] text-gray-400">
              Your share as the {c.payer_role} — {c.commission_percentage}% of {formatNaira(c.base_amount)}
              {c.transaction_type === "rental" ? " annual rent" : " sale price"}
            </p>
            <div className="flex justify-between items-center mt-1.5">
              <p className="text-sm font-bold text-chs-red">{formatNaira(c.commission_amount)}</p>
              <button onClick={() => handlePay(c.id)} disabled={payingId === c.id}
                className="px-3 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">
                {payingId === c.id ? "Paying..." : "Pay from wallet"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
