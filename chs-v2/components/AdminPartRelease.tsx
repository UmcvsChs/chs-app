"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

type Kind = "rent" | "sale" | "rto_payment" | "rto_final";
type St = {
  available: boolean; reason?: string; total?: number; released?: number; cap?: number; max_more?: number; still_held?: number;
  history?: { at: string; pct: number; amount: number; note: string | null }[];
};

const WHO: Record<Kind, string> = { rent: "landlord", sale: "seller", rto_payment: "owner", rto_final: "owner" };

// "Release a percentage" for rent, property sales and rent-to-own. The money stays in the CHS hold until an admin releases
// a part (default up to 60% in total). Two taps, a note is recorded and shown to the owner. The balance is released later in
// the normal way. Sales need a note of at least 10 characters.
export default function AdminPartRelease({ kind, id, onDone }: { kind: Kind; id: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState<St | null>(null);
  const [pct, setPct] = useState("60");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_part_release_state", { p_kind: kind, p_id: id });
    setSt((data as St) || null);
  }, [kind, id]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [open, load]);

  const n = parseFloat(pct);
  const valid = !isNaN(n) && n > 0 && n <= 100;
  const total = st?.total || 0;
  const amount = valid ? Math.round(total * n) / 100 : 0;
  const maxMore = st?.max_more || 0;
  const over = amount > maxMore + 0.005;
  const noteNeeded = kind === "sale" && note.trim().length < 10;

  async function release() {
    setBusy(true); setErr(null); setMsg(null);
    const { data, error } = await supabase.rpc("admin_release_part", { p_kind: kind, p_id: id, p_pct: n, p_note: note || null });
    setBusy(false); setStep("idle");
    if (error) { setErr(error.message); return; }
    const d = data as { amount: number; party_name: string; still_held: number };
    setMsg(`✓ ${formatNaira(d.amount)} released to ${d.party_name}. ${formatNaira(d.still_held)} stays held.`);
    setNote("");
    await load();
    onDone?.();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 w-full py-1.5 rounded-full border border-chs-amber text-chs-charcoal text-[10px] font-semibold">
        Release a percentage to the {WHO[kind]}
      </button>
    );
  }

  return (
    <div className="mt-1.5 border border-chs-amber rounded-lg p-2 bg-white">
      <p className="text-[10px] font-bold text-chs-charcoal">Release a percentage to the {WHO[kind]}</p>
      {!st ? <p className="text-[10px] text-gray-400">Loading…</p> : !st.available ? (
        <p className="text-[10px] text-chs-red">{st.reason}</p>
      ) : (
        <>
          <p className="text-[9px] text-gray-500">
            Held {formatNaira(total)} · already released {formatNaira(st.released || 0)} · you can release up to {formatNaira(maxMore)} more now (limit {st.cap}% in total)
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <input type="number" min={1} max={100} step="any" value={pct} onChange={(e) => { setPct(e.target.value); setStep("idle"); }} className="w-16 px-2 py-1 rounded border border-gray-200 text-[11px]" />
            <span className="text-[11px] text-gray-500">% = <b>{formatNaira(amount)}</b></span>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "sale" ? `Reason (required, recorded and shown to the ${WHO[kind]})` : `Optional note to the ${WHO[kind]} (recorded)`} className="w-full mt-1 px-2 py-1 rounded border border-gray-200 text-[11px]" />
          {over && valid && <p className="text-[10px] text-chs-red mt-1">That is more than the limit allows now (most: {formatNaira(maxMore)}).</p>}
          {step === "idle" ? (
            <button type="button" disabled={!valid || over || noteNeeded || maxMore <= 0} onClick={() => setStep("confirm")} className="w-full mt-1.5 py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-40">
              Release {valid ? n : ""}% to the {WHO[kind]}
            </button>
          ) : (
            <div className="flex gap-1.5 mt-1.5">
              <button type="button" disabled={busy} onClick={release} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">{busy ? "Releasing…" : `Yes, release ${formatNaira(amount)} now`}</button>
              <button type="button" disabled={busy} onClick={() => setStep("idle")} className="px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold">Cancel</button>
            </div>
          )}
          {(st.history || []).length > 0 && (
            <ul className="mt-1.5 text-[9px] text-gray-500 list-disc pl-3">
              {st.history!.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString("en-NG")} · {h.pct}% · {formatNaira(h.amount)}{h.note ? ` · ${h.note}` : ""}</li>)}
            </ul>
          )}
        </>
      )}
      {msg && <p className="text-[10px] text-green-700 font-semibold mt-1">{msg}</p>}
      {err && <p className="text-[10px] text-chs-red mt-1">{err}</p>}
    </div>
  );
}
