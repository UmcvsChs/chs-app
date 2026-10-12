"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { uploadDocument } from "@/lib/storage";
import ServiceTncGate from "@/components/ServiceTncGate";
import { SERVICE_TNC } from "@/types/serviceTnc";
import { CAPACITIES, COMPREHENSION, MANAGEMENT_PURPOSES, MANAGEMENT_TERMS_VERSION, feeLineFor, feeTermsFor, requiredDocuments, tncKeyFor } from "@/lib/managementTerms";

// On each of an owner's properties: ask CHS to manage it, see where the request stands, or ask CHS to stop.
// The owner picks what CHS should manage it for, says in what capacity, uploads the required documents, reads the full
// terms (scroll to the end), answers three short questions, and accepts. A CHS admin then checks the documents and
// approves; approval, not the owner, turns on the "Managed & Advertised by CHS" stamp.
interface Mandate { id: string; property_id: string; purposes: string[]; status: string; admin_note: string | null; tag: string | null }

export default function ManageByChs({ propertyId, defaultPurpose }: { propertyId: string; defaultPurpose?: string }) {
  const { session } = useAuth();
  const [m, setM] = useState<Mandate | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [purposes, setPurposes] = useState<string[]>(defaultPurpose && ["rent", "shortlet", "sale"].includes(defaultPurpose) ? [defaultPurpose] : []);
  const [capacity, setCapacity] = useState("");
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [note, setNote] = useState("");
  const [gate, setGate] = useState<number | null>(null);
  const [termsRead, setTermsRead] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);
  const [accept, setAccept] = useState(false);
  const [reason, setReason] = useState("");
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_management_mandates");
    const mine = (data as Mandate[] | null) ?? [];
    setM(mine.find((x) => x.property_id === propertyId && ["pending", "approved", "end_requested"].includes(x.status)) ?? mine.find((x) => x.property_id === propertyId) ?? null);
  }, [propertyId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const docSlots = capacity ? requiredDocuments(capacity, purposes) : [];
  const docsReady = docSlots.length > 0 && docSlots.every((d) => files[d]);
  const quizPassed = COMPREHENSION.every((c, i) => answers[i] === c.correct);
  const canSubmit = purposes.length > 0 && !!capacity && docsReady && termsRead && quizPassed && accept && !busy;

  function resetTerms() { setTermsRead(false); setAnswers([null, null, null]); setAccept(false); }
  const toggle = (v: string) => { setPurposes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v])); resetTerms(); };

  async function submit() {
    if (!session) return;
    setBusy(true); setErr(null);
    const documents: { label: string; url: string }[] = [];
    for (const label of docSlots) {
      const f = files[label];
      if (!f) continue;
      const url = await uploadDocument(f, session.user.id, "mgmt-" + label.slice(0, 20).replace(/[^a-z0-9]+/gi, "-").toLowerCase());
      if (!url) { setBusy(false); setErr(`Could not upload "${label}". Please try again.`); return; }
      documents.push({ label, url });
    }
    const { error } = await supabase.rpc("request_chs_management_v2", {
      p_property: propertyId, p_purposes: purposes, p_capacity: capacity, p_documents: documents, p_note: note,
      p_fee_terms: feeTermsFor(purposes), p_terms_version: MANAGEMENT_TERMS_VERSION, p_accept: accept,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false); load();
  }
  async function rpc(name: string, args: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc(name, args);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEnding(false); load();
  }

  if (m === undefined) return null;
  const gateKey = gate !== null ? tncKeyFor(purposes[gate]) : "";

  return (
    <div className="mt-3 border border-chs-charcoal/20 rounded-lg p-3 bg-white">
      {gate !== null && SERVICE_TNC[gateKey] && (
        <ServiceTncGate
          serviceType={gateKey}
          onAccept={() => { if (gate + 1 < purposes.length) setGate(gate + 1); else { setGate(null); setTermsRead(true); } }}
          onCancel={() => setGate(null)}
        />
      )}
      {m && m.status === "approved" && (
        <div className="text-xs">
          <p className="font-bold text-chs-charcoal">🛡️ Managed &amp; Advertised by CHS <span className="font-mono font-normal">{m.tag}</span></p>
          {!ending ? (
            <button onClick={() => setEnding(true)} className="mt-1 underline text-[11px] text-gray-600">Ask CHS to stop managing this property</button>
          ) : (
            <div className="mt-2 space-y-1.5">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you want to end this?" className="w-full border border-gray-300 rounded px-2 py-1.5" />
              <button disabled={busy || reason.trim().length < 5} onClick={() => rpc("request_end_management", { p_id: m.id, p_reason: reason })} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white disabled:opacity-50">Send to CHS</button>
            </div>
          )}
        </div>
      )}
      {m && m.status === "end_requested" && <p className="text-xs text-amber-800">You asked CHS to stop managing this property. CHS will confirm shortly.</p>}
      {m && m.status === "pending" && (
        <div className="text-xs">
          <p className="font-semibold text-chs-charcoal">⏳ CHS is reviewing your request to manage this property ({m.purposes.join(", ")}).</p>
          <button disabled={busy} onClick={() => rpc("withdraw_management_request", { p_id: m.id })} className="mt-1 underline text-[11px] text-gray-600">Withdraw request</button>
        </div>
      )}
      {(!m || ["declined", "withdrawn", "ended"].includes(m.status)) && !open && (
        <div className="text-xs">
          {m?.status === "declined" && <p className="text-red-700 mb-1">CHS could not take this on: {m.admin_note}</p>}
          {m?.status === "ended" && <p className="text-gray-600 mb-1">CHS no longer manages this property.</p>}
          <button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-amber-300 font-bold">🛡️ Ask CHS to manage this property</button>
          <p className="text-[10px] text-gray-500 mt-1">CHS runs viewings, bookings and rent for you, and the listing gets the Managed by CHS stamp.</p>
        </div>
      )}
      {open && (
        <div className="text-xs space-y-3">
          <div>
            <p className="font-bold text-chs-charcoal mb-1">1. What should CHS manage this property for?</p>
            <div className="space-y-1">
              {MANAGEMENT_PURPOSES.map((p) => (
                <label key={p.value} className="flex items-start gap-2"><input type="checkbox" checked={purposes.includes(p.value)} onChange={() => toggle(p.value)} className="mt-0.5" />
                  <span><b>{p.label}</b><span className="block text-[10px] text-gray-500">{feeLineFor(p.value)}</span></span></label>
              ))}
            </div>
          </div>

          <div>
            <p className="font-bold text-chs-charcoal mb-1">2. In what capacity are you handing it over?</p>
            <select value={capacity} onChange={(e) => { setCapacity(e.target.value); setFiles({}); }} className="w-full border border-gray-300 rounded px-2 py-1.5 bg-white">
              <option value="">Choose…</option>
              {CAPACITIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {docSlots.length > 0 && (
            <div>
              <p className="font-bold text-chs-charcoal mb-1">3. Upload the documents CHS needs</p>
              <div className="space-y-1.5">
                {docSlots.map((d) => (
                  <label key={d} className="block">
                    <span className="block text-[11px] text-gray-700">{files[d] ? "✓ " : ""}{d}</span>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setFiles({ ...files, [d]: e.target.files?.[0] ?? null })} className="w-full text-[11px]" />
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">CHS checks every document. A property cannot be taken on with false, incomplete or disputed documents.</p>
            </div>
          )}

          {purposes.length > 0 && (
            <div className="bg-chs-charcoal text-white rounded-lg p-3 space-y-1">
              <p className="font-bold text-amber-300">The short version</p>
              <ul className="list-disc ml-4 text-[11px] space-y-0.5">
                <li>You pay <b>one</b> CHS fee, the management fee shown above. It replaces the standard CHS service charge.</li>
                <li>Tenants, guests and buyers see every price and fee on the listing. No hidden charges.</li>
                <li>All money goes through CHS, with receipts. No side deals.</li>
                <li>The property must be genuine, and you must be its owner or hold written authority.</li>
                <li>You can ask CHS to stop managing it. Notice periods are in the full terms.</li>
              </ul>
            </div>
          )}

          <div>
            <p className="font-bold text-chs-charcoal mb-1">4. Read the full terms</p>
            {termsRead ? (
              <p className="text-green-700">✓ You have read the terms.</p>
            ) : (
              <button disabled={purposes.length === 0} onClick={() => setGate(0)} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white font-bold disabled:opacity-50">Read the full terms ({purposes.length || 0})</button>
            )}
          </div>

          {termsRead && (
            <div>
              <p className="font-bold text-chs-charcoal mb-1">5. Three quick questions</p>
              <div className="space-y-2">
                {COMPREHENSION.map((c, i) => (
                  <div key={c.q}>
                    <p className="text-[11px] font-semibold">{c.q}</p>
                    {c.options.map((o, j) => (
                      <label key={o} className="flex items-start gap-1.5 text-[11px]"><input type="radio" name={`q${propertyId}${i}`} checked={answers[i] === j} onChange={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))} className="mt-0.5" />{o}</label>
                    ))}
                    {answers[i] !== null && answers[i] !== c.correct && <p className="text-[10px] text-red-600">Not quite. Please read the terms again.</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Anything CHS should know (optional): current tenants or manager, number of units or rooms…" className="w-full border border-gray-300 rounded px-2 py-1.5" />
          <label className="flex items-start gap-2"><input type="checkbox" checked={accept} disabled={!quizPassed} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5" /><span>I have read the terms. The property is genuine, and I own it or hold written authority. I agree to the terms. I understand CHS may review and change them at any time.</span></label>
          <div className="flex gap-2">
            <button disabled={!canSubmit} onClick={submit} className="px-4 py-1.5 rounded-full bg-chs-red text-white font-bold disabled:opacity-50">{busy ? "Sending…" : "Send request to CHS"}</button>
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-gray-500">Cancel</button>
          </div>
        </div>
      )}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}
