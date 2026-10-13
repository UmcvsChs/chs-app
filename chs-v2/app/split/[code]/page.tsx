"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// A friend or relative chips in toward someone else's booking, from their own CHS wallet.
interface Info {
  split: { code: string; status: string; title: string; check_in: string; check_out: string; needed: number; pooled: number; hold_expires_at: string | null; organiser: string; contributions: { who: string; amount: number; status: string }[] };
  i_am_organiser: boolean; my_total: number;
}
const day = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00+01:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default function SplitPage() {
  const { code } = useParams<{ code: string }>();
  const { session, loading: authLoading } = useAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_split_by_code", { p_code: code });
    if (error) { setErr(error.message); return; }
    setErr(null); setInfo(data as Info);
  }, [code]);
  useEffect(() => {
    if (authLoading || !session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading, session, load]);

  async function pay() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("contribute_to_split", { p_code: code, p_amount: Number(amount) });
    setBusy(false);
    if (error) { setErr(error.message === "insufficient_balance" ? "NEEDS_FUNDS" : error.message); return; }
    const r = data as { status: string; remaining: number };
    setDone(r.status === "paid" ? "Thank you. Your contribution completed the payment and the booking is confirmed." : `Thank you. Your ${formatNaira(Number(amount))} is held safely. ${formatNaira(r.remaining)} is still needed before the deadline; if it is not raised, your money is returned automatically.`);
    setAmount(""); load();
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading…</div>;
  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--zone-bg)] px-4 py-10"><div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 p-5 text-center">
        <p className="text-sm font-bold text-chs-charcoal">Chip in toward a booking</p>
        <p className="text-xs text-gray-500 mt-1">Payment code <b>{String(code).toUpperCase()}</b>. Sign in (or create a free account) to see the details and pay from your CHS wallet, then open this link again.</p>
        <Link href="/login" className="inline-block mt-3 px-5 py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold">Sign in</Link>
      </div></div>
    );
  }
  const s = info?.split;
  const remaining = s ? Number(s.needed) - Number(s.pooled) : 0;
  return (
    <div className="min-h-screen bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto space-y-3">
        <Link href="/guest" className="text-xs text-gray-400">← Back</Link>
        <h1 className="font-serif text-xl font-bold text-chs-charcoal">Chip in toward a booking</h1>
        {err && err !== "NEEDS_FUNDS" && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{err}</p>}
        {err === "NEEDS_FUNDS" && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">Your wallet balance is too low. <Link href="/guest?tab=wallet" className="underline font-semibold">Fund your wallet</Link>, then come back to this link.</p>}
        {s && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-sm font-bold text-chs-charcoal">{s.title}</p>
            <p className="text-xs text-gray-500">{day(s.check_in)} → {day(s.check_out)} · organised by {s.organiser}</p>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-chs-red" style={{ width: `${Math.min(100, Math.round((Number(s.pooled) / Number(s.needed)) * 100))}%` }} /></div>
            <p className="text-xs"><b>{formatNaira(s.pooled)}</b> raised of {formatNaira(s.needed)} · {s.status === "open" ? <b>{formatNaira(remaining)} still needed</b> : <b className="capitalize">{s.status}</b>}</p>
            {s.hold_expires_at && s.status === "open" && <p className="text-[11px] text-gray-500">Deadline: {new Date(s.hold_expires_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
            {s.contributions.length > 0 && <div className="text-[11px] text-gray-600 border-t border-gray-100 pt-1">{s.contributions.map((c, i) => <p key={i}>{c.who}: {formatNaira(c.amount)}</p>)}</div>}
            {info?.my_total ? <p className="text-[11px] text-green-700 font-semibold">You have put in {formatNaira(info.my_total)}.</p> : null}
          </div>
        )}
        {done && <p className="text-xs text-green-700 bg-green-50 rounded-lg p-2">{done}</p>}
        {s && s.status === "open" && !info?.i_am_organiser && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Amount you want to put in (₦)" className="w-full border border-gray-300 rounded-full px-3 py-2 text-sm" />
            <div className="flex gap-1.5 flex-wrap">{[5000, 10000, 20000, 50000].filter((v) => v <= remaining).map((v) => <button key={v} onClick={() => setAmount(String(v))} className="px-3 py-1 rounded-full border border-gray-300 text-[11px]">{formatNaira(v)}</button>)}<button onClick={() => setAmount(String(Math.round(remaining)))} className="px-3 py-1 rounded-full border border-gray-300 text-[11px]">The rest ({formatNaira(remaining)})</button></div>
            <button disabled={busy || !Number(amount)} onClick={pay} className="w-full py-2.5 rounded-full bg-chs-charcoal text-white text-sm font-semibold disabled:opacity-50">{busy ? "Paying…" : "Pay from my CHS wallet"}</button>
            <p className="text-[10px] text-gray-500">Your money is held by CHS, not by the organiser, until the whole amount is raised. If it is not raised before the deadline, or the booking is called off, you get it back automatically. If the booking is later cancelled and refunded, you receive your share of the refund.</p>
          </div>
        )}
        {info?.i_am_organiser && <p className="text-xs text-gray-500 bg-white rounded-lg p-3">This is your own booking. Share this code with the people who will chip in, and manage it from My bookings.</p>}
      </div>
    </div>
  );
}
