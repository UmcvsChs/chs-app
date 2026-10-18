"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const QUESTIONS = [
  { k: "q1", q: "Did you collect this parcel from the seller yourself?" },
  { k: "q2", q: "What condition was the parcel in when you collected it? (sealed, taped, already damaged, wet…)" },
  { k: "q3", q: "Did anything happen on the road? (fall, knock, rain, accident, long delay)" },
  { k: "q4", q: "What condition was it in when you handed it to the buyer? Did the buyer open it or refuse it?" },
  { k: "q5", q: "Anything else CHS should know?" },
];

// Public page: no login. A rider or courier opens the one-time link the seller sent and answers five short questions.
export default function RiderStatement() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<{ valid: boolean; reason?: string; reference?: string; product?: string; parcel?: string } | null>(null);
  const [name, setName] = useState("");
  const [ans, setAns] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => { supabase.rpc("claim_rider_get", { p_token: token }).then(({ data }) => setInfo(data)); }, [token]);

  async function send() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("claim_rider_submit", { p_token: token, p_name: name, p_answers: ans });
    setBusy(false);
    if (error) setErr(error.message); else setDone(true);
  }
  if (!info) return <main className="max-w-md mx-auto p-5 text-sm text-gray-500">Loading…</main>;
  if (done) return <main className="max-w-md mx-auto p-5"><h1 className="text-lg font-bold text-chs-charcoal">Thank you</h1><p className="text-sm text-gray-600 mt-2">Your statement was sent to CHS. You can close this page.</p></main>;
  if (!info.valid) return <main className="max-w-md mx-auto p-5"><h1 className="text-lg font-bold text-chs-charcoal">CHS delivery statement</h1><p className="text-sm text-gray-600 mt-2">{info.reason}</p></main>;
  return (
    <main className="max-w-md mx-auto p-5 pb-16">
      <h1 className="text-lg font-bold text-chs-charcoal">CHS delivery statement</h1>
      <p className="text-xs text-gray-500 mb-4">Parcel {info.parcel} · {info.product}. Please answer honestly. This helps decide a report about this delivery. You can only send this once.</p>
      <label className="block text-xs font-semibold text-gray-700 mb-3">Your name
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-normal" />
      </label>
      {QUESTIONS.map((x) => (
        <label key={x.k} className="block text-xs font-semibold text-gray-700 mb-3">{x.q}
          <textarea rows={2} value={ans[x.k] || ""} onChange={(e) => setAns({ ...ans, [x.k]: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-normal" />
        </label>
      ))}
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <button onClick={send} disabled={busy || name.trim().length < 2 || !ans.q2 || !ans.q4} className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">{busy ? "Sending…" : "Send my statement"}</button>
    </main>
  );
}
