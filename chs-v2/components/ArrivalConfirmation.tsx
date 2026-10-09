"use client";

import { formatDateTime } from "@/lib/format";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// The guest's side of a prepaid stay. The guest pays BEFORE arriving; CHS holds the money only until the
// guest has arrived and found the property as described — then it is released to the host at once.
// (As with a Nigerian rental: you pay ahead, and the landlord is paid when you move in — not a year later.)
//
// The guest ticks that they have arrived, that the property matches its listing, and that each listed
// facility is present and working. That sends a message to the host and to CHS and releases the host's
// payout immediately. If something is wrong the guest reports a problem instead: the money stays held.
// If the guest says nothing, the payout is released automatically 24 hours after check-in.

interface ArrivalState {
  state: string;
  property_title: string;
  check_in: string;
  auto_release_at: string | null;
  facilities: string[];
  bedrooms: number | null;
  bathrooms: number | null;
  confirmed_at: string | null;
  issue_note: string | null;
  release_requested_at: string | null;
}

export default function ArrivalConfirmation({ bookingId, onChanged }: { bookingId: string; onChanged?: () => void }) {
  const [s, setS] = useState<ArrivalState | null>(null);
  const [arrived, setArrived] = useState(false);
  const [matches, setMatches] = useState(false);
  const [allOk, setAllOk] = useState(false);
  const [fac, setFac] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [problemMode, setProblemMode] = useState(false);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_arrival_state", { p_booking_id: bookingId });
    if (data) setS(data as ArrivalState);
  }, [bookingId]);

  useEffect(() => {
    // load() only sets state after its network call returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!s || s.state === "not_applicable") return null;

  const allFacilitiesTicked = s.facilities.every((f) => fac[f]);
  const ready = arrived && matches && allOk && allFacilitiesTicked;
  const autoAt = s.auto_release_at ? formatDateTime(s.auto_release_at) : null;

  async function confirm() {
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc("confirm_shortlet_arrival", {
      p_booking_id: bookingId,
      p_checklist: { arrived, matches_listing: matches, facilities_ok: allOk, facilities: fac },
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (e) { setError(e.message); return; }
    await load(); onChanged?.();
  }

  async function report() {
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc("report_shortlet_arrival_problem", { p_booking_id: bookingId, p_issues: problem.trim() });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setProblemMode(false); await load(); onChanged?.();
  }

  if (s.state === "guest_confirmed") {
    return <p className="mt-2 text-[11px] text-green-700 bg-green-50 rounded-lg px-2.5 py-1.5">✓ You confirmed your arrival{s.confirmed_at ? ` on ${formatDateTime(s.confirmed_at)}` : ""} — your host has been paid. Enjoy your stay.</p>;
  }
  if (s.state === "auto_released") {
    return <p className="mt-2 text-[11px] text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">Your payment was released to the host automatically — no problem was reported within 24 hours of check-in.</p>;
  }
  if (s.state === "released") {
    return <p className="mt-2 text-[11px] text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">✓ Your payment has been released to the host.</p>;
  }
  if (s.state === "problem_reported") {
    return (
      <div className="mt-2 bg-chs-amber-light rounded-lg px-2.5 py-2">
        <p className="text-[11px] font-bold text-chs-red">⚠ You reported a problem</p>
        {s.issue_note && <p className="text-[11px] text-gray-600 italic">“{s.issue_note}”</p>}
        <p className="text-[11px] text-gray-600 mt-0.5">CHS is looking into it. Your payment stays safely held, and the host is not paid, until it is resolved.</p>
      </div>
    );
  }
  if (s.state === "awaiting_arrival_day") {
    return (
      <p className="mt-2 text-[11px] text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">
        📍 Your check-in is on <b>{s.check_in}</b>. When you arrive, come back here and confirm that everything is as described — that releases your payment to the host.
      </p>
    );
  }

  // awaiting_guest_confirmation / release_requested
  return (
    <div className="mt-2 border-2 border-green-300 bg-green-50 rounded-lg p-2.5">
      <p className="text-xs font-bold text-green-800">✅ Arrived? Confirm your stay</p>
      {s.state === "release_requested" && (
        <p className="text-[11px] text-chs-red font-semibold mt-0.5">Your host says you have arrived. Please confirm below if the place is as described — or report a problem.</p>
      )}
      <p className="text-[10px] text-gray-500 mt-0.5">Your payment is held safely. When you confirm, it is released to the host straight away, and both the host and CHS get your message.</p>

      {!problemMode ? (
        <>
          <label className="flex items-start gap-2 mt-2 text-[11px] text-chs-charcoal"><input type="checkbox" checked={arrived} onChange={(e) => setArrived(e.target.checked)} className="mt-0.5" />I have arrived at the property and can get in.</label>
          <label className="flex items-start gap-2 mt-1 text-[11px] text-chs-charcoal"><input type="checkbox" checked={matches} onChange={(e) => setMatches(e.target.checked)} className="mt-0.5" />
            The property matches its listing{s.bedrooms || s.bathrooms ? ` (${[s.bedrooms ? `${s.bedrooms} bedroom${s.bedrooms !== 1 ? "s" : ""}` : "", s.bathrooms ? `${s.bathrooms} bathroom${s.bathrooms !== 1 ? "s" : ""}` : ""].filter(Boolean).join(", ")})` : ""}.</label>
          {s.facilities.length > 0 && (
            <div className="mt-1.5 bg-white rounded-lg px-2 py-1.5">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-chs-charcoal">Listed facilities — tick each one that is present and working:</p>
                <button type="button" onClick={() => setFac(Object.fromEntries(s.facilities.map((f) => [f, true])))} className="text-[10px] font-semibold text-chs-red underline">Tick all</button>
              </div>
              {s.facilities.map((f) => (
                <label key={f} className="flex items-center gap-2 text-[11px] text-chs-charcoal mt-0.5"><input type="checkbox" checked={!!fac[f]} onChange={(e) => setFac({ ...fac, [f]: e.target.checked })} />{f}</label>
              ))}
            </div>
          )}
          <label className="flex items-start gap-2 mt-1.5 text-[11px] text-chs-charcoal"><input type="checkbox" checked={allOk} onChange={(e) => setAllOk(e.target.checked)} className="mt-0.5" />Everything is in good order and I am satisfied with the property.</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Optional message to the host and CHS" className="w-full mt-2 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
          {error && <p className="text-[11px] text-chs-red mt-1">{error}</p>}
          <button onClick={confirm} disabled={!ready || busy} className="w-full mt-2 py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-40">
            {busy ? "Confirming…" : "Confirm — release my payment to the host"}
          </button>
          <button type="button" onClick={() => { setProblemMode(true); setError(null); }} className="w-full mt-1.5 text-[11px] font-semibold text-gray-500 underline">Something is wrong — report a problem</button>
          {autoAt && <p className="text-[10px] text-gray-400 mt-1.5">If we don&apos;t hear from you, the payment is released to the host automatically at {autoAt}, unless you report a problem before then.</p>}
        </>
      ) : (
        <>
          <p className="text-[11px] text-gray-600 mt-2">Tell CHS what is wrong. Your payment stays held and the host is not paid until it is resolved.</p>
          <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} maxLength={500} placeholder="For example: the air conditioning is not working…" className="w-full mt-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]" />
          {error && <p className="text-[11px] text-chs-red mt-1">{error}</p>}
          <button onClick={report} disabled={busy || problem.trim().length < 10} className="w-full mt-2 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-40">{busy ? "Sending…" : "Send report — keep the payment held"}</button>
          <button type="button" onClick={() => setProblemMode(false)} className="w-full mt-1 text-[11px] text-gray-500 underline">Back</button>
        </>
      )}
    </div>
  );
}
