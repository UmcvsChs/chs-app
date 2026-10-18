"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";
import NotificationBell from "@/components/NotificationBell";

// Real, new page completing item #14 — rather than wiring a "View
// Receipt" link into every individual confirmation screen across the
// app (rent payment, remittance, commission, sale), one real, central
// list covers every real transaction a user has ever been part of.
interface RealTransaction {
  reference: string;
  direction: "debit" | "credit";
  amount: number;
  description: string;
  created_at: string;
}

export default function ReceiptsPanel({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<RealTransaction[]>([]);
  const [checkouts, setCheckouts] = useState<{ reference: string; paid_at: string; lines: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    supabase
      .from("wallet_transactions")
      .select("reference, direction, amount, description, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(async ({ data }) => {
        setTransactions(data || []);
        // One combined receipt per marketplace checkout instead of one per item
        const { data: chk } = await supabase.rpc("get_my_checkout_receipts");
        setCheckouts((chk as typeof checkouts) || []);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  if (authLoading || loading) {
    return <div className={`${embedded ? "py-16" : "min-h-screen"} flex items-center justify-center text-sm text-gray-400`}>Loading...</div>;
  }

  // Real, direct fix per a confirmed client report: this used
  // router.back(), a genuine, real browser-history navigation — which
  // depends entirely on whatever page happened to precede this one in
  // the actual browser history, and can easily land on an unrelated
  // property page from earlier browsing rather than the real
  // dashboard the person actually came from. Replaced with the same
  // real, explicit role-to-dashboard mapping used at login.
  const roleToPath: Record<string, string> = {
    admin: "/admin", owner: "/owner", host: "/host", agent: "/agent", manager: "/manager",
    tenant: "/tenant", buyer: "/my-offers", guest: "/guest", developer: "/developer", staff: "/staff",
  };
  const backHref = roleToPath[profile?.role || ""] || "/";

  return (
    <div className={embedded ? "" : "min-h-screen bg-[var(--zone-bg)] pb-10"}>
      {!embedded && (
<div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href={backHref} className="text-xs text-white/70">← Back to Dashboard</Link>
        <div className="flex justify-between items-start">
          <RoleBadge label="My Receipts" />
          <NotificationBell />
        </div>
        <h1 className="font-serif text-lg font-bold mt-1">My Real Receipts</h1>
      </div>
)}

      <div className="px-4 py-4 space-y-2">
        {checkouts.map((c) => (
          <Link key={c.reference} href={`/receipt/${c.reference}`} className="block bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-chs-charcoal">🛒 Marketplace order · {c.lines} {c.lines === 1 ? "item" : "items"} (one receipt)</p>
                <p className="text-[10px] text-gray-400">{formatDateTime(c.paid_at)} · {c.reference}</p>
              </div>
              <p className="text-sm font-bold text-chs-red">-{formatNaira(c.total)}</p>
            </div>
          </Link>
        ))}
        {transactions.length === 0 && checkouts.length === 0 ? (
          <p className="text-xs text-gray-400">No real transactions yet.</p>
        ) : (
          transactions.filter((t) => !(checkouts.length > 0 && t.direction === "debit" && /^(BUYPAY|DLV)-/i.test(t.reference))).map((t, i) => (
            <Link
              key={`${t.reference}-${i}`}
              href={`/receipt/${t.reference}`}
              className="block bg-white rounded-xl border border-gray-200 p-3"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-chs-charcoal">{t.description}</p>
                  <p className="text-[10px] text-gray-400">{formatDateTime(t.created_at)} · {t.reference}</p>
                </div>
                <p className={`text-sm font-bold ${t.direction === "credit" ? "text-green-700" : "text-chs-red"}`}>
                  {t.direction === "credit" ? "+" : "-"}{formatNaira(t.amount)}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
