"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

interface WalletSnapshot {
  main_balance: number;
  rent_savings: number;
  escrow_held: number;
  agent_earnings_pending: number;
}

// Real, new fix per direct client complaint: a tenant, owner, or agent
// had no way to see their own real wallet balance from their own
// dashboard at all — they had to know to separately navigate to
// /wallet. This is a small, reusable widget dropped directly into
// each role's own dashboard header, showing the real balance that
// matters most for that role, with a real link through for everything
// else.
export default function WalletQuickView({ userId, extra, onLight }: { userId: string; extra?: "rent_savings" | "escrow_held" | "agent_earnings"; onLight?: boolean }) {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);

  useEffect(() => {
    supabase
      .from("wallets")
      .select("main_balance, rent_savings, escrow_held, agent_earnings_pending")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setWallet(data));
  }, [userId]);

  if (!wallet) return null;

  const extraLabel =
    extra === "rent_savings" ? "Rent savings" :
    extra === "escrow_held" ? "Held (pending)" :
    extra === "agent_earnings" ? "Pending earnings" : null;
  const extraValue =
    extra === "rent_savings" ? wallet.rent_savings :
    extra === "escrow_held" ? wallet.escrow_held :
    extra === "agent_earnings" ? wallet.agent_earnings_pending : 0;

  // Real, direct fix following a direct, specific client report: this
  // component's original white-on-translucent-white styling only
  // ever worked correctly sitting on the app's own dark header bars —
  // reused as-is on a light page body, the same styling became nearly
  // invisible. A real, second style now exists for exactly that case,
  // rather than the same broken look spreading everywhere this
  // component gets reused.
  return (
    <Link href="/wallet" className={`flex items-center gap-3 rounded-xl px-3 py-2 shrink-0 ${onLight ? "bg-white border border-gray-200" : "bg-white/15"}`}>
      <div>
        <p className={`text-[9px] uppercase font-semibold ${onLight ? "text-gray-400" : "text-white/60"}`}>My Wallet</p>
        <p className={`text-sm font-bold ${onLight ? "text-chs-charcoal" : "text-white"}`}>{formatNaira(wallet.main_balance)}</p>
      </div>
      {extraLabel && (
        <div className={`border-l pl-3 ${onLight ? "border-gray-200" : "border-white/20"}`}>
          <p className={`text-[9px] uppercase font-semibold ${onLight ? "text-gray-400" : "text-white/60"}`}>{extraLabel}</p>
          <p className="text-xs font-bold text-chs-red">{formatNaira(extraValue)}</p>
        </div>
      )}
    </Link>
  );
}
