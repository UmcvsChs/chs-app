"use client";

import ConfirmPay from "@/components/ConfirmPay";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// Tenant-side rent by instalments on a CHS-managed property. Shows the plan chooser (first year, or inside the 30-day
// renewal window) and, once a plan is running, the schedule with a "Pay next instalment" button. The owner decides which
// plans are allowed; CHS does not guarantee unpaid instalments.
interface Option { plan: string; count: number; per: number; first_payment: number }
interface Inst { seq: number; period_start: string; period_end: string; due_date: string; amount: number; status: string; paid_at: string | null }
interface Plan { eligible: boolean; reason: string | null; pay_plan: string; allowed: string[]; is_renewal: boolean; agency_fee_first: number; options: Option[]; installments: Inst[] }

const LABEL: Record<string, string> = { annual: "Pay the full year", quarterly: "Pay quarterly", monthly: "Pay monthly" };
const day = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function RentInstalments({ tenancyId, onChanged }: { tenancyId: string; onChanged?: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_rent_plan", { p_tenancy: tenancyId });
    setPlan(error ? null : (data as Plan));
  }, [tenancyId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function run(fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, ok: (d: Record<string, number | string>) => string) {
    setBusy(true); setMsg(null);
    const { data, error } = await fn();
    setBusy(false);
    if (error) { setMsg(error.message.includes("insufficient_balance") ? "Insufficient wallet balance for this instalment." : error.message.replace("not_yet_due: ", "")); return; }
    setMsg(ok((data ?? {}) as Record<string, number | string>));
    setPick(null);
    await load();
    onChanged?.();
  }

  if (!plan) return null;
  const due = plan.installments.filter((i) => i.status === "due");
  const running = due.length > 0;
  const choices = plan.options.filter((o) => (plan.pay_plan === "annual" ? o.plan !== "annual" : true));
  if (!running && (!plan.eligible || choices.length === 0)) return null;
  const next = due[0];
  const canSeeNext = next && (next.seq === 1 || new Date(next.due_date + "T00:00:00").getTime() <= now + 14 * 86400000);

  return (
    <div className="mt-1.5 bg-white border border-gray-200 rounded-lg p-2.5">
      <p className="text-xs font-bold text-chs-charcoal">Rent by instalments</p>
      {running ? (
        <>
          <p className="text-[10px] text-gray-500 mb-1.5">Your {plan.pay_plan} plan. Each instalment is held safely by CHS, like annual rent.</p>
          <ul className="space-y-0.5">
            {plan.installments.map((i) => (
              <li key={i.seq} className="flex justify-between text-[11px]">
                <span className={i.status === "paid" ? "text-green-700" : "text-gray-700"}>
                  {i.status === "paid" ? "✓" : "•"} {i.seq}. {day(i.period_start)}{i.status === "due" && new Date(i.due_date + "T00:00:00").getTime() < now - 86400000 ? " (overdue)" : ""}
                </span>
                <span className="font-semibold">{formatNaira(i.amount)}</span>
              </li>
            ))}
          </ul>
          {next && canSeeNext && (
            <div className="mt-1.5">
              {next.seq === 1 && !plan.is_renewal && plan.agency_fee_first > 0 && (
                <p className="text-[10px] text-gray-500 mb-1">First instalment includes your one-time CHS agency fee of {formatNaira(plan.agency_fee_first)} (paid from your main wallet).</p>
              )}
              <ConfirmPay busy={busy} amountText={formatNaira(next.amount + (next.seq === 1 && !plan.is_renewal ? plan.agency_fee_first : 0))} whatFor={`for rent instalment ${next.seq}`}
                onConfirm={() => run(() => supabase.rpc("pay_rent_installment", { p_tenancy: tenancyId, p_wallet_source: "main" }), (d) => `✓ Instalment ${d.seq} paid. Ref: ${d.reference}`)}
                className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50"
                label={busy ? "Processing..." : `Pay instalment ${next.seq} from Main Wallet — ${formatNaira(next.amount + (next.seq === 1 && !plan.is_renewal ? plan.agency_fee_first : 0))}`} />
              {!(next.seq === 1 && !plan.is_renewal && plan.agency_fee_first > 0) && (
                <ConfirmPay busy={busy} amountText={formatNaira(next.amount)} whatFor="from your Rent Savings, for this instalment"
                  onConfirm={() => run(() => supabase.rpc("pay_rent_installment", { p_tenancy: tenancyId, p_wallet_source: "rent_savings" }), (d) => `✓ Instalment ${d.seq} paid from rent savings.`)}
                  className="mt-1 w-full py-2 rounded-full bg-white border-2 border-chs-red text-chs-red text-xs font-semibold disabled:opacity-50"
                  label={`Pay from Rent Savings — ${formatNaira(next.amount)}`} />
              )}
            </div>
          )}
          {next && !canSeeNext && <p className="text-[10px] text-gray-500 mt-1.5">Your next instalment opens for payment on {day(new Date(new Date(next.due_date + "T00:00:00").getTime() - 14 * 86400000).toISOString().slice(0, 10))}.</p>}
        </>
      ) : (
        <>
          <p className="text-[10px] text-gray-500 mb-1.5">
            {plan.is_renewal ? "Choose how to pay your next year." : "Your landlord allows you to spread this year's rent."}
            {" "}You can still pay the full year in one go.
          </p>
          <div className="space-y-1">
            {choices.map((o) => (
              <button key={o.plan} onClick={() => setPick(o.plan)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] ${pick === o.plan ? "border-chs-red bg-red-50" : "border-gray-200"}`}>
                <span className="font-semibold">{LABEL[o.plan]}</span>{o.plan !== "annual" && <> — {o.count} × {formatNaira(o.per)}</>}
                {o.plan !== "annual" && !plan.is_renewal && plan.agency_fee_first > 0 && <span className="block text-gray-500">First payment {formatNaira(o.first_payment)} incl. your CHS agency fee</span>}
              </button>
            ))}
          </div>
          {pick && (
            <div className="mt-1.5">
              {pick !== "annual" && <p className="text-[10px] text-gray-500 mb-1">By choosing this plan you agree to pay each instalment on its date. Missing instalments can end your tenancy under your landlord&apos;s terms.</p>}
              <button disabled={busy} onClick={() => run(() => supabase.rpc("start_rent_plan", { p_tenancy: tenancyId, p_plan: pick }), () => (pick === "annual" ? "Plan set to full-year payment." : "✓ Plan started. Pay your first instalment below."))}
                className="w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">
                {busy ? "Saving..." : pick === "annual" ? "Use full-year payment" : `Start ${pick} plan`}
              </button>
            </div>
          )}
        </>
      )}
      {msg && <p className="text-[10px] text-gray-600 mt-1">{msg}</p>}
    </div>
  );
}
