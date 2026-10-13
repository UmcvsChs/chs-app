"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// "I can't go ahead": move the dates free of charge, or be refunded, when something outside the guest's and the venue's control gets in the way.
const REASONS = [
  { v: "disruption_event", l: "A disruption CHS has declared (curfew, flood, government order…)" },
  { v: "bereavement", l: "A death in the immediate family" },
  { v: "medical", l: "A medical emergency" },
  { v: "other", l: "Another reason outside my control" },
];

export default function GuestDisruptionClaim({ bookingId, onDone }: { bookingId: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [reasonType, setReasonType] = useState("disruption_event");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [choice, setChoice] = useState<"reschedule" | "refund">("reschedule");
  const [newDate, setNewDate] = useState("");
  const [suggest, setSuggest] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function pickReschedule() {
    setChoice("reschedule");
    const { data } = await supabase.rpc("suggest_free_dates", { p_booking: bookingId, p_after: null });
    setSuggest(((data as { dates?: string[] } | null)?.dates) || []);
  }

  async function submit() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("request_disruption_claim", {
      p_booking: bookingId, p_reason_type: reasonType, p_reason: reason, p_evidence: evidence || null, p_choice: choice, p_new_check_in: choice === "reschedule" ? newDate || null : null,
    });
    setBusy(false);
    if (error) { setErr(error.message.replace(/^dates_unavailable:\s*/, "")); return; }
    const r = data as { status: string; outcome?: string };
    setDone(r.status === "completed" ? "Done. Your booking has moved to the new dates, with nothing more to pay." : "Sent to the venue. They have 48 hours to reply; track it under Cancelled & refunds.");
    onDone?.();
  }

  if (done) return <p className="text-[11px] text-green-700 font-semibold mt-2">✓ {done}</p>;
  if (!open) return <button onClick={() => setOpen(true)} className="text-[11px] underline text-chs-charcoal mt-2">I can&apos;t go ahead (something outside my control)</button>;

  return (
    <div className="mt-2 border border-gray-200 rounded-xl p-3 text-xs space-y-2 bg-gray-50">
      <p className="font-semibold text-chs-charcoal">When nobody is at fault</p>
      <p className="text-[11px] text-gray-500">If something outside your control and the venue&apos;s stops you, you can move to a new date at no charge or get a refund. The venue may keep only costs it has really incurred, up to a limit; CHS gives its own fee back. If you are just changing your mind, use Cancel on the booking instead.</p>
      <select value={reasonType} onChange={(e) => setReasonType(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-[11px] bg-white">
        {REASONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
      </select>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="What happened? (a sentence or two)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-[11px]" />
      {reasonType !== "disruption_event" && <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Link to proof, if you have it (death notice, hospital letter, news report)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-[11px]" />}
      <div className="flex gap-2">
        <button type="button" onClick={pickReschedule} className={`flex-1 py-1.5 rounded-full border text-[11px] font-semibold ${choice === "reschedule" ? "bg-chs-charcoal text-white border-chs-charcoal" : "bg-white"}`}>Move my dates</button>
        <button type="button" onClick={() => setChoice("refund")} className={`flex-1 py-1.5 rounded-full border text-[11px] font-semibold ${choice === "refund" ? "bg-chs-charcoal text-white border-chs-charcoal" : "bg-white"}`}>Refund me</button>
      </div>
      {choice === "reschedule" && (
        <div className="space-y-1">
          {suggest.length > 0 && <div className="flex gap-1.5 flex-wrap">{suggest.map((d) => <button key={d} type="button" onClick={() => setNewDate(d)} className={`px-2.5 py-1 rounded-full border text-[11px] ${newDate === d ? "bg-chs-red text-white border-chs-red" : "bg-white"}`}>{d}</button>)}</div>}
          <label className="block text-[10px] text-gray-500">New start date <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 text-[11px] ml-1" /></label>
          <p className="text-[10px] text-gray-500">Same number of nights. A date someone else has already booked and paid for cannot be used; the suggested dates are free.</p>
        </div>
      )}
      {err && <p className="text-red-600 text-[11px]">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy || reason.trim().length < 10 || (choice === "reschedule" && !newDate)} onClick={submit} className="px-4 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">{busy ? "Sending…" : "Send"}</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-full border text-[11px]">Close</button>
      </div>
    </div>
  );
}
