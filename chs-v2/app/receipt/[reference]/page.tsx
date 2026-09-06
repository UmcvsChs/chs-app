"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// Real, new page per direct client request: neither CHS nor its
// agents/managers could issue a real receipt to a client for any
// transaction — confirmed genuinely missing. This works for any real
// transaction reference (rent, remittance, commission, sale, etc.)
// using the browser's own real print-to-PDF, so no extra document
// library or infrastructure is needed.
interface ReceiptEntry {
  direction: "debit" | "credit";
  amount: number;
  description: string;
  created_at: string;
  full_name: string;
  phone: string;
}

export default function ReceiptPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = use(params);
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<ReceiptEntry[]>([]);
  const [viewerIsPayee, setViewerIsPayee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    supabase.rpc("get_receipt_data", { p_reference: reference }).then(({ data, error: rpcError }) => {
      if (rpcError) {
        setError(rpcError.message);
      } else {
        setEntries(data?.entries || []);
        setViewerIsPayee(!!data?.viewer_is_payee);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, reference]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm font-semibold text-chs-red mb-2">Could not load this receipt</p>
        <p className="text-xs text-gray-500 mb-4">{error}</p>
        <Link href="/" className="text-sm font-semibold text-chs-red">Back to homepage</Link>
      </div>
    );
  }

  const payer = entries.find((e) => e.direction === "debit");
  const payee = entries.find((e) => e.direction === "credit");
  const amount = payer?.amount || payee?.amount || 0;
  const date = payer?.created_at || payee?.created_at;

  // Real, direct fix per a genuine, confirmed gap: this same document
  // always labeled itself a "receipt," even for someone who had just
  // been paid — an owner receiving real sale proceeds should see a
  // genuine payment voucher / remittance advice, not a receipt for
  // money moving into their own wallet. Server-verified via auth.uid(),
  // not a client-side guess.
  const isVoucher = viewerIsPayee;
  const documentLabel = isVoucher ? "PAYMENT VOUCHER / REMITTANCE ADVICE" : "RECEIPT";

  return (
    <div className="min-h-screen bg-[#e5e2dc] py-10 px-4 print:bg-white print:p-0 font-sans">
      <style>{`
        @media print { .no-print { display: none !important; } }
        .receipt-seal {
          position: absolute; top: 108px; right: 24px; width: 84px; height: 84px;
          border: 2px solid rgba(30,27,22,0.09); border-radius: 50%;
          display: flex; align-items: center; justify-content: center; transform: rotate(-16deg);
        }
        .receipt-seal::before { content: ""; position: absolute; inset: 6px; border: 1px dashed rgba(30,27,22,0.09); border-radius: 50%; }
        .receipt-divider { height: 1px; background: repeating-linear-gradient(90deg, #e3ddd2 0, #e3ddd2 4px, transparent 4px, transparent 8px); }
        .receipt-corner { position: absolute; width: 14px; height: 14px; border-color: #e8622f; opacity: 0.5; }
      `}</style>

      <div className="max-w-md mx-auto bg-[#fffdfb] rounded print:rounded-none shadow-[0_8px_30px_rgba(30,27,22,0.15)] print:shadow-none relative overflow-hidden">
        <div className="receipt-corner top-2 left-2 border-t-2 border-l-2 no-print" />
        <div className="receipt-corner top-2 right-2 border-t-2 border-r-2 no-print" />

        {/* Header band — real, deliberate branding per direct client
            request: a plain data table didn't read as a genuine,
            professional financial document. */}
        <div className="bg-gradient-to-br from-chs-charcoal to-[#2a251d] px-8 pt-7 pb-5 text-white relative">
          <div className="absolute left-0 right-0 -bottom-px h-1 bg-gradient-to-r from-chs-red via-chs-amber to-chs-red" />
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-[22px] font-extrabold tracking-wide">CH<span className="text-chs-red">S</span></p>
              <p className="text-[10.5px] text-[#b8b2a6] mt-0.5">Complete Housing Solutions</p>
            </div>
            <span className="text-[9px] font-bold tracking-wider bg-chs-red/20 text-[#ffb388] border border-chs-red/40 rounded-full px-2.5 py-1.5 whitespace-nowrap">
              {documentLabel}
            </span>
          </div>
        </div>

        <div className="px-8 pt-7 pb-6 relative">
          <div className="receipt-seal">
            <p className="text-[8px] font-extrabold uppercase tracking-wide text-center leading-relaxed" style={{ color: "rgba(30,27,22,0.16)" }}>CHS<br />Verified<br />★</p>
          </div>

          <div className="text-center mb-6">
            <p className="text-[10px] text-[#9a9184] uppercase tracking-[2px] font-semibold">Amount</p>
            <p className="font-serif text-[32px] font-extrabold text-chs-charcoal mt-1">{formatNaira(amount)}</p>
            <span className="inline-flex items-center gap-1 bg-[#eaf5ec] text-[#2c7a3d] text-[10.5px] font-bold px-3 py-1.5 rounded-full mt-2">
              ✓ Verified &amp; Confirmed
            </span>
          </div>

          <div className="receipt-divider my-5" />

          <div className="text-[13.5px]">
            <div className="flex justify-between items-start gap-5 py-2.5 border-b border-[#f1ede6]">
              <span className="text-[#8f8776] font-medium whitespace-nowrap">Reference</span>
              <span className="font-bold text-chs-charcoal text-right font-mono text-[12.5px] tracking-wide">{reference}</span>
            </div>
            {date && (
              <div className="flex justify-between items-start gap-5 py-2.5 border-b border-[#f1ede6]">
                <span className="text-[#8f8776] font-medium whitespace-nowrap">Date</span>
                <span className="font-bold text-chs-charcoal text-right">{new Date(date).toLocaleString()}</span>
              </div>
            )}
            {payer && (
              <div className="flex justify-between items-start gap-5 py-2.5 border-b border-[#f1ede6]">
                <span className="text-[#8f8776] font-medium whitespace-nowrap">{isVoucher ? "Originally paid by" : "From"}</span>
                <span className="font-bold text-chs-charcoal text-right">{payer.full_name}</span>
              </div>
            )}
            {payee && (
              <div className="flex justify-between items-start gap-5 py-2.5">
                <span className="text-[#8f8776] font-medium whitespace-nowrap">{isVoucher ? "Remitted to" : "To"}</span>
                <span className="font-bold text-chs-charcoal text-right">{payee.full_name}</span>
              </div>
            )}
          </div>

          {(payer || payee) && (
            <div className="bg-[#fbf8f3] border border-[#f0ebe1] rounded-lg px-3.5 py-3 mt-4 text-[12.5px] text-[#55503f] leading-relaxed">
              <span className="block text-[9.5px] font-bold uppercase tracking-wide text-[#a89a7a] mb-1">Description</span>
              {(payer || payee)!.description}
            </div>
          )}
        </div>

        <div className="bg-[#f7f4ee] border-t border-[#ece6d8] px-8 pt-4 pb-5 text-center">
          <p className="text-[10.5px] text-[#6b6455] leading-relaxed mb-3.5">
            This is a real, system-generated {isVoucher ? "payment voucher" : "receipt"} from <span className="font-bold text-chs-charcoal">CHS — Complete Housing Solutions</span>, verifiable at any time using the reference number above.
          </p>
          <button
            onClick={() => window.print()}
            className="w-full py-3 rounded-full bg-chs-red text-white text-[13.5px] font-bold shadow-[0_4px_14px_rgba(232,98,47,0.35)] no-print"
          >
            🖨️ Print / Save as PDF
          </button>
          <Link href="/" className="block text-center text-xs text-gray-400 mt-3 no-print">
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
