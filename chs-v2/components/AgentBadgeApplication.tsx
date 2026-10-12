"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { uploadDocument } from "@/lib/storage";
import ServiceTncGate from "@/components/ServiceTncGate";
import { REG_BODY_LABEL } from "@/components/AgentBadge";

// The agent's own view of the CHS-approved agent badge: where they stand on each requirement, and the application.
// The requirements are enforced in the database (backend-v2/485). Only a registered company or a regulator-registered
// firm can apply; an individual cannot.
interface Elig { kyc_ok: boolean; kyc_missing: string[]; deals: number; deals_needed: number; deals_ok: boolean; window_days: number; corporate_ok: boolean; corporate_note: string; terms_ok: boolean; all_ok: boolean }
interface My { approved: boolean; active: boolean; since: string | null; valid_until: string | null; revoked: boolean; revoked_note: string | null; eligibility: Elig; application: { id: string; status: string; decision_note: string | null; entity_name: string } | null; terms_version: string }

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "");
const Tick = ({ ok }: { ok: boolean }) => <span className={ok ? "text-green-600" : "text-gray-400"}>{ok ? "✓" : "○"}</span>;
const KEY = "CHS-approved agent badge";

export default function MyAgentApprovalCard() {
  const { session } = useAuth();
  const [s, setS] = useState<My | null>(null);
  const [open, setOpen] = useState(false);
  const [gate, setGate] = useState(false);
  const [read, setRead] = useState(false);
  const [accept, setAccept] = useState(false);
  const [body, setBody] = useState("CAC_COMPANY");
  const [num, setNum] = useState(""); const [name, setName] = useState("");
  const [regOn, setRegOn] = useState(""); const [exp, setExp] = useState("");
  const [office, setOffice] = useState("");
  const [cert, setCert] = useState<File | null>(null);
  const [princ, setPrinc] = useState([{ name: "", role: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_agent_approval");
    setS(data as My | null);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  if (!s) return null;
  const e = s.eligibility;
  const pending = s.application?.status === "pending";

  async function submit() {
    if (!session || !cert) { setErr("Please attach your registration certificate."); return; }
    setBusy(true); setErr(null);
    const url = await uploadDocument(cert, session.user.id, "badge-certificate");
    if (!url) { setBusy(false); setErr("Could not upload the certificate. Please try again."); return; }
    const { error } = await supabase.rpc("submit_agent_badge_application", {
      p_reg_body: body, p_reg_number: num, p_entity_name: name, p_registered_on: regOn || null, p_reg_expiry: exp || null,
      p_certificate_url: url, p_office_address: office, p_principals: princ.filter((p) => p.name.trim()), p_terms_version: s!.terms_version,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false); load();
  }

  return (
    <div className={`rounded-xl border p-3 ${s.active ? "bg-chs-charcoal border-amber-300 text-white" : "bg-white border-gray-200"}`}>
      {gate && <ServiceTncGate serviceType={KEY} onAccept={() => { setGate(false); setRead(true); }} onCancel={() => setGate(false)} />}
      {s.active ? (
        <>
          <p className="text-xs font-bold text-amber-300">✔ Your firm is a CHS-approved agent</p>
          <p className="text-[11px] text-white/80 mt-0.5">Valid until {fmt(s.valid_until)}. Renew at least 30 days before. Keep your registration and KYC current, or the badge hides itself.</p>
        </>
      ) : (
        <>
          <p className="text-xs font-bold text-chs-charcoal">CHS-approved agent badge</p>
          {s.revoked && <p className="text-[11px] text-chs-red mt-0.5">Your badge was removed: {s.revoked_note}</p>}
          {s.application?.status === "rejected" && <p className="text-[11px] text-chs-red mt-0.5">Your last application was not approved: {s.application.decision_note}</p>}
          {pending && <p className="text-[11px] text-amber-800 mt-0.5">⏳ CHS is reviewing your application for {s.application?.entity_name}. This includes checks on your registration, directors and references.</p>}
          <p className="text-[11px] text-gray-600 mt-0.5">The badge is for registered companies and firms only. CHS puts its name behind every holder, so every requirement must be met.</p>
          <ul className="text-[11px] mt-1.5 space-y-0.5">
            <li><Tick ok={e.kyc_ok} /> <b>Complete, current KYC.</b> {e.kyc_ok ? "Done." : e.kyc_missing.join("; ") + "."}</li>
            <li><Tick ok={e.deals_ok} /> <b>Track record:</b> {e.deals} of {e.deals_needed} income-generating transactions on CHS in the last {e.window_days} days.</li>
            <li><Tick ok={e.corporate_ok} /> <b>Registered body</b> (CAC company, ESVARBON firm or QSRBN firm): {e.corporate_note}.</li>
          </ul>
          {!pending && !open && (
            <button disabled={!e.kyc_ok || !e.deals_ok} onClick={() => setOpen(true)} className="mt-2 px-3 py-1.5 rounded-full bg-chs-charcoal text-amber-300 text-[11px] font-bold disabled:opacity-40">
              {e.kyc_ok && e.deals_ok ? "Apply for the badge" : "Apply (finish the requirements first)"}
            </button>
          )}
          {pending && <button onClick={async () => { await supabase.rpc("withdraw_agent_badge_application"); load(); }} className="mt-1 text-[11px] underline text-gray-600">Withdraw application</button>}
          {open && (
            <div className="mt-2 space-y-2 text-xs">
              <select value={body} onChange={(ev) => setBody(ev.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 bg-white">
                {Object.entries(REG_BODY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Registered name of the company or firm" className="w-full border border-gray-300 rounded px-2 py-1.5" />
              <input value={num} onChange={(ev) => setNum(ev.target.value)} placeholder={body === "CAC_COMPANY" ? "RC number" : "Registration number"} className="w-full border border-gray-300 rounded px-2 py-1.5" />
              <div className="flex gap-2">
                <label className="flex-1 text-[10px] text-gray-500">Registered on<input type="date" value={regOn} onChange={(ev) => setRegOn(ev.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" /></label>
                <label className="flex-1 text-[10px] text-gray-500">Registration or licence expires{body !== "CAC_COMPANY" && " *"}<input type="date" value={exp} onChange={(ev) => setExp(ev.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" /></label>
              </div>
              <input value={office} onChange={(ev) => setOffice(ev.target.value)} placeholder="Registered office address" className="w-full border border-gray-300 rounded px-2 py-1.5" />
              <div>
                <p className="text-[10px] font-semibold text-gray-600">Directors or principals</p>
                {princ.map((p, i) => (
                  <div key={i} className="flex gap-1.5 mt-1">
                    <input value={p.name} onChange={(ev) => setPrinc(princ.map((x, k) => (k === i ? { ...x, name: ev.target.value } : x)))} placeholder="Full name" className="flex-1 border border-gray-300 rounded px-2 py-1.5" />
                    <input value={p.role} onChange={(ev) => setPrinc(princ.map((x, k) => (k === i ? { ...x, role: ev.target.value } : x)))} placeholder="Role" className="w-28 border border-gray-300 rounded px-2 py-1.5" />
                  </div>
                ))}
                <button type="button" onClick={() => setPrinc([...princ, { name: "", role: "" }])} className="mt-1 text-[11px] underline text-chs-red">+ Add another</button>
              </div>
              <label className="block text-[10px] text-gray-500">Registration certificate (photo or PDF)<input type="file" accept="image/*,application/pdf" onChange={(ev) => setCert(ev.target.files?.[0] ?? null)} className="block w-full text-xs mt-0.5" /></label>
              <div>
                <button type="button" onClick={() => setGate(true)} className="underline text-[11px] font-semibold text-chs-red">{read ? "✓ Terms read (read again)" : "Read the badge terms (required)"}</button>
                <label className="flex items-start gap-2 mt-1"><input type="checkbox" disabled={!read} checked={accept} onChange={(ev) => setAccept(ev.target.checked)} className="mt-0.5" />
                  <span>I am authorised to apply for this body, I have read and accept the badge terms, and everything above is true.</span></label>
              </div>
              {err && <p className="text-chs-red text-[11px]">{err}</p>}
              <div className="flex gap-2">
                <button disabled={busy || !accept} onClick={submit} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-amber-300 font-bold text-[11px] disabled:opacity-40">{busy ? "Sending…" : "Send application"}</button>
                <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[11px]">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
