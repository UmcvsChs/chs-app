"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

// Lets any signed-in person report a listing: hidden or wrong price, a duplicate or fake, already taken, scam behaviour.
// The owner never sees who reported.
const REASONS: [string, string][] = [
  ["hidden_price", "The price is hidden or I was told to DM for it"],
  ["wrong_price", "The real price is different from what is shown"],
  ["fake_or_duplicate", "Fake, or a copy of another listing"],
  ["already_taken", "It is already sold, rented or no longer available"],
  ["scam_behaviour", "Asked me to pay outside CHS or behaved like a scammer"],
  ["other", "Something else"],
];

export default function ReportListingButton({ propertyId }: { propertyId: string }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("hidden_price");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("report_listing", { p_property_id: propertyId, p_reason: reason, p_details: details || null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("Thank you. CHS will look into it and tell you what it finds."); setOpen(false);
  }

  if (msg) return <p className="text-[11px] text-green-700 mt-3">{msg}</p>;
  return (
    <div className="mt-3">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-[11px] text-gray-500 underline">🚩 Report this listing</button>
      ) : !session ? (
        <p className="text-[11px] text-gray-500">Please sign in to report a listing.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-chs-charcoal">What is wrong with this listing?</p>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs">
            {REASONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={3} placeholder="Tell us more (optional, no phone numbers please)" className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs" />
          <p className="text-[10px] text-gray-400">The owner is not told who reported.</p>
          {err && <p className="text-[11px] text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button disabled={busy} onClick={send} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">Send report</button>
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-full border text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
