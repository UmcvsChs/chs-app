"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import PaymentSafetyNotice from "@/components/PaymentSafetyNotice";

// Where anyone who asked for a physical visit sees it through. The transport cost is paid FROM THE WALLET like every
// other payment on CHS, and held until the visit: it goes to the agent who travelled, or comes back if CHS or the
// owner cancels (or if the requester cancels at least 12 hours ahead). The WHOLE cost is the requester's.

interface Insp {
  id: string; reference: string; requested_date: string; requested_time: string; status: string; payment_status: string;
  transport_fee: number | null; fee_final: boolean; takeoff_point: string | null; distance_km: number | null;
  properties: { title: string; location_area: string | null } | { title: string; location_area: string | null }[] | null;
}

const first = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default function MyInspectionsPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [items, setItems] = useState<Insp[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("inspections")
      .select("id, reference, requested_date, requested_time, status, payment_status, transport_fee, fee_final, takeoff_point, distance_km, properties(title, location_area)")
      .eq("requester_id", session.user.id)
      .order("created_at", { ascending: false });
    setItems((data as unknown as Insp[]) || []);
  }, [session]);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.push("/login"); return; }
    // load() only sets state after its network call returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [loading, session, router, load]);

  async function pay(id: string, fee: number) {
    setBusy(id); setMessage((m) => ({ ...m, [id]: "" }));
    const { error } = await supabase.rpc("pay_inspection_fee", { p_inspection_id: id });
    setBusy(null);
    if (error) {
      setMessage((m) => ({ ...m, [id]: error.message.includes("insufficient_balance") ? `Your wallet does not hold ${formatNaira(fee)}. Top up your wallet, then come back to pay.` : error.message }));
      return;
    }
    await load();
  }

  async function cancel(id: string) {
    setBusy(id); setConfirmCancel(null);
    const { data, error } = await supabase.rpc("cancel_inspection", { p_inspection_id: id });
    setBusy(null);
    if (error) { setMessage((m) => ({ ...m, [id]: error.message })); return; }
    setMessage((m) => ({ ...m, [id]: data?.refunded ? "Cancelled — your payment has been returned to your wallet." : data?.paid_to_agent ? "Cancelled — because it was less than 12 hours before the visit, the transport cost goes to your agent." : "Cancelled — nothing was charged." }));
    await load();
  }

  const label: Record<string, string> = { pending: "Waiting for CHS to confirm your agent", awaiting_payment: "Confirmed — pay the transport cost", confirmed: "Confirmed and paid", completed: "Visit completed", cancelled: "Cancelled", no_show: "Marked as not attended" };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="px-4 pt-4">
        <Link href="/" className="text-xs text-gray-500">← Home</Link>
        <h1 className="font-serif text-lg font-bold mt-1">My Inspections</h1>
        <p className="text-[11px] text-gray-500 mt-0.5">Physical visits you asked for. The photographs and videos are free; if you still want to visit in person, the whole transport cost is yours, paid from your CHS Wallet.</p>
      </div>
      <div className="px-4 mt-3"><PaymentSafetyNotice variant="full" /></div>

      <div className="px-4 mt-3">
        {items.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">You have not booked any inspections.</p>
        ) : items.map((i) => {
          const p = first(i.properties);
          const needsPay = i.status === "awaiting_payment" && i.payment_status !== "held" && i.fee_final && i.transport_fee != null;
          const open = ["pending", "awaiting_payment", "confirmed"].includes(i.status);
          return (
            <div key={i.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2.5">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm font-semibold text-chs-charcoal">{p?.title || "Property"}</p>
                <span className="text-[9px] font-bold uppercase bg-chs-amber-light text-chs-amber-dark px-2 py-0.5 rounded-full whitespace-nowrap">{i.status.replace("_", " ")}</span>
              </div>
              <p className="text-[11px] text-gray-500">{p?.location_area} · 📅 {i.requested_date} at {i.requested_time?.slice(0, 5)} · Ref {i.reference}</p>
              <p className="text-[11px] text-gray-600 mt-1">{label[i.status] || i.status}</p>

              {i.transport_fee != null && (
                <p className="text-xs text-chs-charcoal mt-1">
                  🚗 Transport cost (100% yours): <b>{formatNaira(i.transport_fee)}</b>{" "}
                  <span className="text-gray-500">{i.fee_final ? `— final, agent from ${i.takeoff_point}, ${i.distance_km} km each way` : "— an estimate until CHS confirms your agent"}</span>
                </p>
              )}
              {i.payment_status === "held" && <p className="text-[11px] text-green-700 mt-1">✓ Paid from your wallet and held safely until the visit.</p>}
              {i.payment_status === "released" && <p className="text-[11px] text-gray-600 mt-1">Paid to your agent for the visit.</p>}
              {i.payment_status === "refunded" && <p className="text-[11px] text-gray-600 mt-1">Refunded to your wallet.</p>}

              {needsPay && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <p className="text-xs text-chs-charcoal">Pay <b>{formatNaira(i.transport_fee as number)}</b> from your wallet at least 2 hours before the visit, or it lapses and nothing is charged.</p>
                  <PaymentSafetyNotice variant="compact" className="mt-1" />
                  {message[i.id] && <p className="text-[11px] text-chs-red mt-1">{message[i.id]} {message[i.id].includes("wallet") && <Link href="/wallet" className="font-semibold underline">Top up →</Link>}</p>}
                  <button onClick={() => pay(i.id, i.transport_fee as number)} disabled={busy === i.id} className="w-full mt-2 py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
                    {busy === i.id ? "Paying…" : `Pay ${formatNaira(i.transport_fee as number)} from my wallet`}
                  </button>
                </div>
              )}
              {!needsPay && message[i.id] && <p className="text-[11px] text-gray-600 mt-1.5">{message[i.id]}</p>}

              {open && (
                confirmCancel === i.id ? (
                  <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[11px] text-gray-600">{i.payment_status === "held"
                      ? "Cancel this visit? If the visit is at least 12 hours away you are refunded in full; inside 12 hours the cost goes to your agent."
                      : "Cancel this visit? Nothing has been charged."}</p>
                    <div className="flex gap-2 mt-1.5">
                      <button onClick={() => cancel(i.id)} disabled={busy === i.id} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-700 text-[11px] font-semibold">Yes, cancel</button>
                      <button onClick={() => setConfirmCancel(null)} className="flex-1 py-1.5 rounded-full bg-white border border-gray-200 text-[11px]">Keep it</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmCancel(i.id)} className="mt-2 text-[11px] font-semibold text-gray-500 underline">Cancel this inspection</button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
