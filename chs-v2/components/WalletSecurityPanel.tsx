"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime } from "@/lib/format";
import PaymentSafetyNotice from "@/components/PaymentSafetyNotice";

// The account holder's own controls over their wallet — the layers that answer "how do we know it is really you?":
//  • a TRANSACTION PIN (separate from the login PIN) that must be entered to send money or withdraw,
//  • a one-tap FREEZE if they suspect someone is in their account,
//  • and a plain statement of the limits and the pause on money received from another user.
export interface WalletSecurityStatus {
  has_pin: boolean; transfer_requires_pin: boolean; withdrawal_requires_pin: boolean; frozen: boolean;
  locked_amount: number; withdrawable: number; next_unlock: string | null;
  limit_single: number; limit_daily: number; sent_today: number; remaining_today: number; hold_hours: number;
}

export default function WalletSecurityPanel({ status, onChanged }: { status: WalletSecurityStatus | null; onChanged: () => void }) {
  const [showPin, setShowPin] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmFreeze, setConfirmFreeze] = useState(false);

  if (!status) return null;
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    if (next.length !== 6) { setOk(false); setMsg("Your PIN must be exactly 6 digits."); return; }
    if (next !== again) { setOk(false); setMsg("The two PINs do not match."); return; }
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc("set_transaction_pin", { p_pin: next, p_current_pin: status!.has_pin ? current : null });
    setBusy(false);
    if (error) { setOk(false); setMsg(error.message); return; }
    if (data && data.ok === false) { setOk(false); setMsg(data.error); return; }
    setOk(true); setMsg(status!.has_pin ? "✓ Your PIN was changed." : "✓ Your transaction PIN is set. You will be asked for it whenever money leaves your wallet.");
    setCurrent(""); setNext(""); setAgain(""); setShowPin(false); onChanged();
  }

  async function freeze() {
    setBusy(true);
    const { error } = await supabase.rpc("freeze_my_wallet");
    setBusy(false); setConfirmFreeze(false);
    if (error) { setOk(false); setMsg(error.message); return; }
    setOk(true); setMsg("🧊 Your wallet is frozen. Contact CHS to verify your identity and unfreeze it."); onChanged();
  }

  const box = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm tracking-widest";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs font-bold text-chs-charcoal">🔒 Wallet security</p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-chs-charcoal">Transaction PIN {status.has_pin ? <span className="text-green-700">✓ set</span> : <span className="text-chs-red">not set</span>}</p>
          <p className="text-[10px] text-gray-500">{status.has_pin ? "Asked for whenever money leaves your wallet." : "Proves it is really you. Without it, anyone who gets into your phone could send your money."}</p>
        </div>
        <button onClick={() => { setShowPin(!showPin); setMsg(null); }} className="shrink-0 text-[11px] font-semibold text-white bg-chs-charcoal px-3 py-1.5 rounded-full">
          {showPin ? "Cancel" : status.has_pin ? "Change PIN" : "Set PIN"}
        </button>
      </div>

      {showPin && (
        <form onSubmit={savePin} className="mt-2 space-y-1.5">
          {status.has_pin && <input type="password" inputMode="numeric" autoComplete="off" value={current} onChange={(e) => setCurrent(digits(e.target.value))} placeholder="Current PIN" className={box} />}
          <input type="password" inputMode="numeric" autoComplete="off" value={next} onChange={(e) => setNext(digits(e.target.value))} placeholder="New 6-digit PIN" className={box} />
          <input type="password" inputMode="numeric" autoComplete="off" value={again} onChange={(e) => setAgain(digits(e.target.value))} placeholder="Repeat the new PIN" className={box} />
          <p className="text-[10px] text-gray-400">Not a repeat (111111) or a simple run (123456). Never share it — CHS will never ask for it.</p>
          <button type="submit" disabled={busy} className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save PIN"}</button>
        </form>
      )}

      {msg && <p className={`mt-2 text-[11px] rounded-lg px-2.5 py-1.5 ${ok ? "text-green-700 bg-green-50" : "text-chs-red bg-chs-amber-light"}`}>{msg}</p>}

      <div className="mt-2 text-[10px] text-gray-500 space-y-0.5">
        <p>Sending to another CHS user: up to <b>{formatNaira(status.limit_single)}</b> at a time and <b>{formatNaira(status.limit_daily)}</b> a day ({formatNaira(status.remaining_today)} left today). A first transfer to someone new is capped for 24 hours.</p>
        <p>Money you receive from another CHS user can be used inside CHS at once, and withdrawn to a bank after <b>{status.hold_hours} hours</b>.</p>
        {status.locked_amount > 0 && (
          <p className="text-chs-amber-dark font-semibold">⏳ {formatNaira(status.locked_amount)} cannot go to a bank yet{status.next_unlock ? ` (earliest ${formatDateTime(status.next_unlock)})` : " (under CHS review)"}. You can withdraw {formatNaira(status.withdrawable)} now.</p>
        )}
      </div>

      {status.frozen ? (
        <p className="mt-2 text-[11px] bg-red-50 text-chs-red rounded-lg px-2.5 py-1.5">🧊 Your wallet is frozen — no money can leave it. Contact CHS to verify your identity and unfreeze it.</p>
      ) : confirmFreeze ? (
        <div className="mt-2 bg-red-50 rounded-lg p-2.5">
          <p className="text-[11px] text-chs-red font-semibold">Freeze your wallet now?</p>
          <p className="text-[10px] text-gray-600">All transfers, payments and withdrawals stop until CHS verifies you and unfreezes it. Use this if you think someone else has your phone, your PIN, or is pressuring you to pay.</p>
          <div className="flex gap-2 mt-1.5">
            <button onClick={freeze} disabled={busy} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[11px] font-semibold disabled:opacity-50">{busy ? "Freezing…" : "Yes, freeze it"}</button>
            <button onClick={() => setConfirmFreeze(false)} className="flex-1 py-1.5 rounded-full bg-white border border-gray-200 text-[11px]">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmFreeze(true)} className="mt-2 text-[11px] font-semibold text-chs-red underline">🧊 Suspect something? Freeze my wallet now</button>
      )}
      <PaymentSafetyNotice variant="compact" className="mt-2" />
    </div>
  );
}

// Beside a transfer you SENT: "this was not me / I was tricked". CHS holds the amount in the recipient's wallet and investigates.
export function ReportTransferLink({ reference, onDone }: { reference: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function send() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("report_fraudulent_transfer", { p_reference: reference, p_note: note.trim() || null });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg("✓ Reported. CHS has put the amount on hold in the recipient's wallet and will investigate."); setOpen(false); onDone();
  }
  if (msg && !open) return <p className="text-[10px] text-green-700 mt-1">{msg}</p>;
  return open ? (
    <div className="mt-1.5 bg-red-50 rounded-lg p-2">
      <p className="text-[10px] text-chs-red font-semibold">Report this transfer as not authorised, or a scam</p>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="What happened? (no phone numbers)" className="w-full mt-1 px-2 py-1.5 rounded border border-gray-200 text-[11px]" />
      {msg && <p className="text-[10px] text-chs-red mt-1">{msg}</p>}
      <div className="flex gap-2 mt-1.5">
        <button onClick={send} disabled={busy} className="flex-1 py-1 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">{busy ? "Sending…" : "Send report"}</button>
        <button onClick={() => setOpen(false)} className="flex-1 py-1 rounded-full bg-white border border-gray-200 text-[10px]">Cancel</button>
      </div>
    </div>
  ) : (
    <button onClick={() => setOpen(true)} className="text-[10px] font-semibold text-chs-red underline mt-0.5">Not you, or a scam? Report this transfer</button>
  );
}
