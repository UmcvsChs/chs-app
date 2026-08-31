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
export default function WalletQuickView({ userId, extra }: { userId: string; extra?: "rent_savings" | "escrow_held" | "agent_earnings" }) {
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

  return (
    <Link href="/wallet" className="flex items-center gap-3 bg-white/15 rounded-xl px-3 py-2 shrink-0">
      <div>
        <p className="text-[9px] text-white/60 uppercase font-semibold">My Wallet</p>
        <p className="text-sm font-bold text-white">{formatNaira(wallet.main_balance)}</p>
      </div>
      {extraLabel && extraValue > 0 && (
        <div className="border-l border-white/20 pl-3">
          <p className="text-[9px] text-white/60 uppercase font-semibold">{extraLabel}</p>
          <p className="text-xs font-bold text-chs-amber">{formatNaira(extraValue)}</p>
        </div>
      )}
    </Link>
  );
}
