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

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm p-8 print:shadow-none print:rounded-none">
        <div className="text-center mb-6 pb-6 border-b-2 border-chs-charcoal">
          <p className="font-serif text-2xl font-bold text-chs-charcoal">CHS</p>
          <p className="text-xs text-gray-500">Complete Housing Solutions</p>
          <p className="text-xs font-bold text-green-700 mt-3">✓ REAL, VERIFIED RECEIPT</p>
        </div>

        <div className="text-center mb-6">
          <p className="text-xs text-gray-400 uppercase">Amount</p>
          <p className="text-3xl font-bold text-chs-charcoal">{formatNaira(amount)}</p>
        </div>

        <div className="space-y-3 text-sm mb-6">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">Reference</span>
            <span className="font-semibold text-chs-charcoal">{reference}</span>
          </div>
          {date && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Date</span>
              <span className="font-semibold text-chs-charcoal">{new Date(date).toLocaleString()}</span>
            </div>
          )}
          {payer && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">From</span>
              <span className="font-semibold text-chs-charcoal">{payer.full_name}</span>
            </div>
          )}
          {payee && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">To</span>
              <span className="font-semibold text-chs-charcoal">{payee.full_name}</span>
            </div>
          )}
          {payer && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Description</span>
              <span className="font-semibold text-chs-charcoal text-right">{payer.description}</span>
            </div>
          )}
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          This is a real, system-generated receipt from CHS, verifiable at any time using the reference number above.
        </p>

        <button
          onClick={() => window.print()}
          className="w-full mt-6 py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold print:hidden"
        >
          🖨️ Print / Save as PDF
        </button>
        <Link href="/" className="block text-center text-xs text-gray-400 mt-3 print:hidden">
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
