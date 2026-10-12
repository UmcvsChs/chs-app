import { formatNaira } from "@/lib/format";

// What it costs to move in, itemised. A tenant should never find out about extra charges after deciding.
// CHS-managed listings carry only the published CHS agency fee. For any other listing the card shows what the lister
// declared, and tells the tenant what to ask for in writing.

export interface MoveInCost {
  rent: number; period: string | null; level: string;
  chs_fee_pct: number; chs_fee: number;
  lister_fees: { label: string; pct: number; amount: number }[]; lister_fees_total: number;
  deposit: number; total: number;
  rent_plans?: string[]; monthly_first_payment?: number; quarterly_first_payment?: number;
}

export default function MoveInCostCard({ cost }: { cost: MoveInCost }) {
  const managed = cost.level === "chs_managed";
  const hasLister = cost.lister_fees.length > 0;
  return (
    <div className={`rounded-xl border p-3 mb-4 ${managed ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
      <p className="text-xs font-bold text-chs-charcoal mb-2">🧾 What you pay to move in</p>
      <div className="space-y-1 text-xs text-gray-700">
        <div className="flex justify-between"><span>Rent{cost.period ? ` ${cost.period}` : ""}</span><span>{formatNaira(cost.rent)}</span></div>
        <div className="flex justify-between"><span>CHS agency fee ({cost.chs_fee_pct}%)</span><span>{formatNaira(cost.chs_fee)}</span></div>
        {cost.lister_fees.map((f, i) => (
          <div key={i} className="flex justify-between"><span>{f.label} ({f.pct}%)</span><span>{formatNaira(f.amount)}</span></div>
        ))}
        <div className="flex justify-between font-bold text-sm text-chs-charcoal border-t border-gray-300 pt-1.5 mt-1.5"><span>Total to move in</span><span>{formatNaira(cost.total)}</span></div>
        {managed && cost.rent_plans?.includes("monthly") && <p className="text-[10px] text-gray-600">Or pay monthly: first payment {formatNaira(cost.monthly_first_payment ?? 0)} (including the CHS agency fee), then 11 equal monthly payments.</p>}
        {managed && !cost.rent_plans?.includes("monthly") && cost.rent_plans?.includes("quarterly") && <p className="text-[10px] text-gray-600">Or pay quarterly: first payment {formatNaira(cost.quarterly_first_payment ?? 0)} (including the CHS agency fee), then 3 equal quarterly payments.</p>}
        {managed && cost.rent_plans?.includes("monthly") && cost.rent_plans?.includes("quarterly") && <p className="text-[10px] text-gray-600">Quarterly is also available.</p>}
        {cost.deposit > 0 && <p className="text-[10px] text-gray-500">A refundable security deposit of {formatNaira(cost.deposit)} may also apply.</p>}
      </div>
      {managed ? (
        <p className="text-[11px] text-green-800 mt-2">✓ CHS-managed: no agent commission, no legal or agreement fee, no &quot;RCD&quot; fee and no inspection fee. If anyone asks you for these on this property, report it to CHS.</p>
      ) : hasLister ? (
        <p className="text-[10px] text-gray-500 mt-2">The extra lines above are the lister&apos;s own fees, declared on this listing. They are not CHS fees.</p>
      ) : (
        <p className="text-[10px] text-gray-500 mt-2">This listing is not managed by CHS and declares no other fees. Before you pay anyone or pay for an inspection, ask for every fee in writing: agent fee, legal or agreement fee, caution or RCD, inspection fee. Paying through CHS keeps a receipt for each one.</p>
      )}
    </div>
  );
}
