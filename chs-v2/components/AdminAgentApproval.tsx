"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { REG_BODY_LABEL } from "@/components/AgentBadge";

// Admin: review CHS-approved agent badge applications. The system shows the automatic checks (KYC, track record, registration);
// a CHS officer must also tick all eight manual checks before the database will approve. Approved badges can be removed with a reason.
interface Elig { kyc_ok: boolean; kyc_missing: string[]; deals: number; deals_needed: number; deals_ok: boolean; window_days: number; corporate_ok: boolean; terms_ok: boolean; all_ok: boolean }
interface Pending { id: string; agent_id: string; agent_name: string; chs_agent_id: string | null; reg_body: string; reg_number: string; entity_name: string; registered_on: string | null; reg_expiry: string | null; certificate_url: string; office_address: string; principals: { name: string; role: string }[]; submitted_at: string; eligibility: Elig; id_document_url: string | null; valid_id_document_url: string | null; reference_1: string | null; reference_2: string | null; residential_address: string | null }
interface Approved { agent_id: string; agent_name: string; chs_agent_id: string | null; entity_name: string | null; reg_body: string | null; reg_number: string | null; valid_until: string | null; revoked_at: string | null; revoked_note: string | null; active: boolean }

const CHECKS: [string, string][] = [
  ["id_matches_nin", "The ID document, the NIN and the person's face match"],
  ["address_verified", "The residential address is real (utility bill or visit)"],
  ["principals_kyc", "Every director or principal listed has passed KYC"],
  ["registration_verified_at_source", "The registration is confirmed on the CAC / ESVARBON / QSRBN register, and is current"],
  ["office_verified", "The registered office exists"],
  ["references_checked", "At least two independent references were contacted"],
  ["adverse_record_check", "No fraud, court judgment, regulator sanction or upheld complaint found"],
  ["fee_conduct_ok", "No history of taking fees outside CHS or against published fees"],
];
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "—");

export default function AdminAgentApproval() {
  const [data, setData] = useState<{ pending: Pending[]; approved: Approved[] } | null>(null);
  const [ticks, setTicks] = useState<Record<string, Record<string, boolean>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removeFor, setRemoveFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const { data: d } = await supabase.rpc("admin_list_agent_badge_applications");
    setData(d as typeof data);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function decide(id: string, approve: boolean) {
    setBusy(id); setMsg(null);
    const { error } = await supabase.rpc("admin_decide_agent_badge", { p_application: id, p_approve: approve, p_checklist: ticks[id] ?? {}, p_note: notes[id] || null });
    setBusy(null);
    if (error) { setMsg(error.message); return; }
    load();
  }
  async function remove(agent: string) {
    setBusy(agent); setMsg(null);
    const { error } = await supabase.rpc("admin_set_agent_approval", { p_agent: agent, p_approve: false, p_note: reason.trim() });
    setBusy(null);
    if (error) { setMsg(error.message); return; }
    setRemoveFor(null); setReason(""); load();
  }

  if (!data) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
      <p className="text-sm font-bold text-chs-charcoal">CHS-approved agent badge</p>
      <p className="text-[11px] text-gray-500 mb-2">Only registered companies and firms (CAC, ESVARBON, QSRBN). The database refuses approval unless KYC is complete and current, the firm has at least 10 income-generating transactions in the last 180 days, the registration is current, the terms were accepted, and you have ticked all eight checks below.</p>
      {msg && <p className="text-[11px] text-chs-red mb-1">{msg}</p>}
      {data.pending.length === 0 && <p className="text-xs text-gray-400">No applications waiting.</p>}
      {data.pending.map((a) => {
        const e = a.eligibility; const t = ticks[a.id] ?? {};
        const allTicked = CHECKS.every(([k]) => t[k]);
        return (
          <div key={a.id} className="border border-gray-200 rounded-lg p-2.5 mb-2 text-xs">
            <p className="font-bold">{a.entity_name} <span className="font-normal text-gray-500">· {REG_BODY_LABEL[a.reg_body]} {a.reg_number}</span></p>
            <p className="text-[10px] text-gray-500">Applied by {a.agent_name} ({a.chs_agent_id}) on {fmt(a.submitted_at)} · registered {fmt(a.registered_on)} · expires {fmt(a.reg_expiry)}</p>
            <p className="text-[10px] text-gray-500">Office: {a.office_address}</p>
            <p className="text-[10px] text-gray-500">Principals: {a.principals.map((p) => `${p.name} (${p.role})`).join(", ")}</p>
            <p className="text-[10px] text-gray-500">References: {a.reference_1 || "none"}; {a.reference_2 || "none"}</p>
            <p className="text-[10px] mt-1">
              <a href={a.certificate_url} target="_blank" rel="noopener noreferrer" className="underline mr-2">Registration certificate</a>
              {a.id_document_url && <a href={a.id_document_url} target="_blank" rel="noopener noreferrer" className="underline mr-2">ID document</a>}
              {a.valid_id_document_url && <a href={a.valid_id_document_url} target="_blank" rel="noopener noreferrer" className="underline">Valid ID</a>}
            </p>
            <ul className="mt-1.5 text-[11px]">
              <li>{e.kyc_ok ? "✓" : "✕"} KYC complete and current{!e.kyc_ok && `: ${e.kyc_missing.join("; ")}`}</li>
              <li>{e.deals_ok ? "✓" : "✕"} {e.deals} of {e.deals_needed} income-generating transactions in {e.window_days} days</li>
              <li>{e.corporate_ok ? "✓" : "✕"} Registration current · {e.terms_ok ? "✓ terms accepted" : "✕ terms not accepted"}</li>
            </ul>
            <p className="text-[10px] font-bold uppercase text-gray-500 mt-2">Your checks (all required)</p>
            {CHECKS.map(([k, label]) => (
              <label key={k} className="flex items-start gap-2 mt-0.5"><input type="checkbox" checked={!!t[k]} onChange={(ev) => setTicks({ ...ticks, [a.id]: { ...t, [k]: ev.target.checked } })} className="mt-0.5" /><span>{label}</span></label>
            ))}
            <input value={notes[a.id] ?? ""} onChange={(ev) => setNotes({ ...notes, [a.id]: ev.target.value })} placeholder="Note (required if you decline; the agent sees it)" className="w-full border border-gray-200 rounded px-2 py-1.5 mt-2" />
            <div className="flex gap-2 mt-2">
              <button disabled={busy === a.id || !e.all_ok || !allTicked} onClick={() => decide(a.id, true)} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-amber-300 font-bold text-[11px] disabled:opacity-40">Approve badge</button>
              <button disabled={busy === a.id || !(notes[a.id] ?? "").trim()} onClick={() => decide(a.id, false)} className="px-3 py-1.5 rounded-full bg-chs-red text-white font-bold text-[11px] disabled:opacity-40">Decline</button>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] font-bold uppercase text-gray-500 mt-3 mb-1">Badge holders</p>
      {data.approved.length === 0 && <p className="text-xs text-gray-400">None yet.</p>}
      {data.approved.map((r) => (
        <div key={r.agent_id} className="border-t border-gray-100 py-2 text-xs">
          <div className="flex justify-between gap-2">
            <div>
              <p className="font-semibold">{r.entity_name} {r.active ? <span className="text-[9px] font-bold bg-chs-charcoal text-amber-300 px-1.5 py-0.5 rounded-full ml-1">SHOWING</span> : <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full ml-1">HIDDEN</span>}</p>
              <p className="text-[10px] text-gray-500">{r.chs_agent_id} · {r.reg_body ? REG_BODY_LABEL[r.reg_body] : ""} {r.reg_number} · valid to {fmt(r.valid_until)}{r.revoked_at ? ` · removed: ${r.revoked_note}` : ""}</p>
            </div>
            {!r.revoked_at && <button onClick={() => setRemoveFor(r.agent_id)} className="text-[10px] font-semibold text-chs-red underline shrink-0">Remove badge</button>}
          </div>
          {removeFor === r.agent_id && (
            <div className="mt-1.5 flex gap-1.5">
              <input value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Reason (the agent will see it)" className="flex-1 border border-gray-200 rounded px-2 py-1 text-[11px]" />
              <button disabled={!reason.trim() || busy === r.agent_id} onClick={() => remove(r.agent_id)} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-chs-red text-white disabled:opacity-40">Remove</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
