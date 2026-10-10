"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateTime, formatNaira } from "@/lib/format";

// The host's plan: what is on offer, what they are on, subscribe from the wallet, cancel at period end.
interface Plan { key: string; name: string; monthly_price: number | null; discount_pts: number; blurb: string }
interface Overview {
  enforced: boolean; plans: Plan[]; wallet_balance: number;
  mine: { plan: string; status: string; pilot: boolean; subscribed_plan: string | null; period_end: string | null; grace_until: string | null; cancel_at_period_end: boolean; started_at: string | null };
  history: { kind: string; plan: string | null; amount: number | null; note: string | null; reference: string | null; at: string }[];
}

export default function HostPlans() {
  const [open, setOpen] = useState(false);
  const [o, setO] = useState<Overview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_subscription_overview");
    if (error) setErr(error.message); else setO(data as Overview);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && !o) load();
  }, [open, o, load]);

  async function subscribe(p: Plan) {
    if (!p.monthly_price) return;
    if (!window.confirm(`Pay ${formatNaira(p.monthly_price)} from your wallet for 30 days of ${p.name}? It renews from your wallet every 30 days until you cancel.`)) return;
    setBusy(true); setErr(null); setMsg(null);
    const { data, error } = await supabase.rpc("subscribe_to_plan", { p_plan: p.key });
    setBusy(false);
    if (error) { setErr(error.message === "insufficient_balance" ? "Your wallet does not hold enough. Top up first." : error.message); return; }
    setMsg(`${p.name} is active. Reference ${(data as { reference: string }).reference}.`);
    load();
  }
  async function cancel() {
    if (!window.confirm("Stop renewing? Your plan stays active until the end of the period you paid for.")) return;
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("cancel_subscription");
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("Done. It will not renew."); load();
  }

  const m = o?.mine;
  const statusText = !m ? "" : m.status === "none" ? "Listed (free)"
    : m.status === "active" ? `${m.plan === "listed" ? "Listed" : m.plan} ${m.pilot ? "(free pilot)" : ""} until ${formatDateTime(m.period_end)}${m.cancel_at_period_end ? ", will not renew" : ""}`
    : m.status === "grace" ? `Renewal failed. Top up before ${formatDateTime(m.grace_until)} or you move to Listed.`
    : "Listed. Your earlier records stay readable and downloadable.";

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex justify-between items-center px-3 py-2.5 text-xs font-bold text-chs-charcoal">
        <span>⭐ Plans: Listed, Pro &amp; Business</span><span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {!o ? <p className="text-[11px] text-gray-400">{err || "Loading…"}</p> : (
            <>
              <p className="text-[11px] text-chs-charcoal"><b>You are on:</b> {statusText}</p>
              {!o.enforced && <p className="text-[10px] text-gray-500">Right now every tool is open to all hosts while CHS tests the plans. Pro and Business still lower your CHS commission.</p>}
              {o.plans.map((p) => (
                <div key={p.key} className={`border rounded-lg p-2 ${m?.plan === p.key ? "border-chs-charcoal" : "border-gray-200"}`}>
                  <div className="flex justify-between">
                    <p className="text-xs font-semibold text-chs-charcoal">{p.name}</p>
                    <p className="text-xs text-chs-charcoal">{p.key === "listed" ? "Free" : p.monthly_price ? `${formatNaira(p.monthly_price)} / 30 days` : "Not open yet"}</p>
                  </div>
                  <p className="text-[10px] text-gray-500">{p.blurb}</p>
                  {p.discount_pts > 0 && <p className="text-[10px] text-green-700">Your commission on bookings drops by {p.discount_pts} percentage point(s).</p>}
                  {p.key !== "listed" && p.monthly_price && m?.plan !== p.key && (
                    <button disabled={busy} onClick={() => subscribe(p)} className="mt-1.5 px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Pay from wallet</button>
                  )}
                </div>
              ))}
              <p className="text-[10px] text-gray-400">Wallet: {formatNaira(o.wallet_balance)}. Switching up charges only the difference for the unused days. You can export your records at any time, on any plan.</p>
              {m?.status === "active" && !m.pilot && !m.cancel_at_period_end && <button disabled={busy} onClick={cancel} className="text-[10px] underline text-red-600">Cancel renewal</button>}
              {o.history.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-chs-charcoal">History</p>
                  {o.history.map((h, i) => <p key={i} className="text-[10px] text-gray-500">{formatDateTime(h.at)} · {h.kind.replace(/_/g, " ")}{h.plan ? ` · ${h.plan}` : ""}{h.amount ? ` · ${formatNaira(h.amount)}` : ""}{h.reference ? ` · ${h.reference}` : ""}</p>)}
                </div>
              )}
            </>
          )}
          {msg && <p className="text-[11px] text-green-700">{msg}</p>}
          {err && o && <p className="text-[11px] text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
