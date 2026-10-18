"use client";

import Link from "next/link";
import InfoTip from "@/components/InfoTip";
import { formatNaira, formatDateTime } from "@/lib/format";

export interface CheckoutReceiptData {
  checkout_ref: string; paid_at: string; buyer_name: string; delivery_address: string | null;
  lines: { reference: string; name: string; seller: string | null; quantity: number; unit_price: number; amount: number; commission: number; options: Record<string, string> | null }[];
  items_total: number; commission_total: number; delivery_total: number;
  shipments: { reference: string; status: string; seller: string | null }[];
}

// One receipt for the whole basket: every item with its own price, then the cumulative total the buyer actually paid.
export default function CheckoutReceipt({ data }: { data: CheckoutReceiptData }) {
  const grand = Number(data.items_total) + Number(data.commission_total) + Number(data.delivery_total);
  return (
    <div className="min-h-screen bg-[#e5e2dc] py-10 px-4 print:bg-white print:p-0 font-sans">
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="max-w-md mx-auto bg-[#fffdfb] rounded print:rounded-none shadow-[0_8px_30px_rgba(30,27,22,0.15)] print:shadow-none overflow-hidden">
        <div className="bg-gradient-to-br from-chs-charcoal to-[#2a251d] px-6 pt-7 pb-5 text-white relative">
          <div className="absolute left-0 right-0 -bottom-px h-1 bg-gradient-to-r from-chs-red via-chs-amber to-chs-red" />
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-[22px] font-extrabold tracking-wide">CH<span className="text-chs-red">S</span></p>
              <p className="text-[10.5px] text-[#b8b2a6] mt-0.5">Complete Housing Solutions</p>
            </div>
            <span className="text-[9px] font-bold tracking-wider bg-chs-red/20 text-[#ffb388] border border-chs-red/40 rounded-full px-2.5 py-1.5 whitespace-nowrap">RECEIPT</span>
          </div>
        </div>

        <div className="px-6 pt-6 pb-4">
          <div className="text-center mb-4">
            <p className="text-[10px] text-[#9a9184] uppercase tracking-[2px] font-semibold">Total paid</p>
            <p className="font-serif text-[30px] font-extrabold text-chs-charcoal mt-1">{formatNaira(grand)}</p>
            <span className="inline-flex items-center gap-1 bg-[#eaf5ec] text-[#2c7a3d] text-[10.5px] font-bold px-3 py-1.5 rounded-full mt-2">✓ Paid &amp; held safely by CHS</span>
          </div>

          <div className="text-[12.5px] border-y border-[#f1ede6] py-2 mb-3 space-y-1">
            <div className="flex justify-between gap-4"><span className="text-[#8f8776]">Receipt no.</span><span className="font-mono font-bold">{data.checkout_ref}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[#8f8776]">Date</span><span className="font-bold text-right">{formatDateTime(data.paid_at)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[#8f8776]">Paid by</span><span className="font-bold text-right">{data.buyer_name}</span></div>
            {data.delivery_address && <div className="flex justify-between gap-4"><span className="text-[#8f8776] shrink-0">Deliver to</span><span className="font-bold text-right">{data.delivery_address}</span></div>}
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wide text-[#a89a7a] mb-1">Items ({data.lines.length})</p>
          <div>
            {data.lines.map((l) => (
              <div key={l.reference} className="py-2 border-b border-[#f1ede6] text-[12.5px]">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold text-chs-charcoal">{l.name}{l.options && Object.keys(l.options).length ? ` (${Object.values(l.options).join(", ")})` : ""}</span>
                  <span className="font-bold text-chs-charcoal whitespace-nowrap">{formatNaira(l.amount)}</span>
                </div>
                <p className="text-[10.5px] text-[#8f8776]">{l.quantity} × {formatNaira(l.unit_price)}{l.seller ? ` · sold by ${l.seller}` : ""} · {l.reference}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[12.5px] space-y-1.5">
            <div className="flex justify-between"><span className="text-[#6b6455]">Items subtotal</span><span className="font-semibold">{formatNaira(data.items_total)}</span></div>
            <div className="flex justify-between"><span className="text-[#6b6455]">CHS service fee</span><span className="font-semibold">{formatNaira(data.commission_total)}</span></div>
            <div className="flex justify-between"><span className="text-[#6b6455]">Delivery and transit insurance</span><span className="font-semibold">{formatNaira(data.delivery_total)}</span></div>
            <div className="flex justify-between border-t-2 border-chs-charcoal pt-2 text-[14px]"><span className="font-extrabold">TOTAL PAID</span><span className="font-extrabold">{formatNaira(grand)}</span></div>
          </div>

          {data.shipments.length > 0 && (
            <div className="mt-4 bg-[#fbf8f3] border border-[#f0ebe1] rounded-lg px-3 py-2.5 text-[11.5px] text-[#55503f]">
              <span className="block text-[9.5px] font-bold uppercase tracking-wide text-[#a89a7a] mb-1">Delivered in {data.shipments.length} {data.shipments.length === 1 ? "parcel" : "parcels"}</span>
              {data.shipments.map((s) => <p key={s.reference}>{s.reference}{s.seller ? ` · ${s.seller}` : ""}</p>)}
            </div>
          )}
        </div>

        <div className="bg-[#f7f4ee] border-t border-[#ece6d8] px-6 pt-4 pb-5 text-center">
          <p className="text-[10.5px] text-[#6b6455] leading-relaxed mb-3.5">This is a real, system-generated receipt from <span className="font-bold text-chs-charcoal">CHS — Complete Housing Solutions</span>, verifiable at any time using the receipt number above.</p>
          <button onClick={() => window.print()} className="w-full py-3 rounded-full bg-chs-red text-white text-[13.5px] font-bold no-print">🖨️ Print / Save as PDF<InfoTip term="digital_receipts" /></button>
          <Link href="/marketplace/orders" className="block text-center text-xs text-gray-400 mt-3 no-print">Back to my orders</Link>
        </div>
      </div>
    </div>
  );
}
