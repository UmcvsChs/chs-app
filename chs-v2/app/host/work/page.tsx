"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import HotelOperations from "@/components/HotelOperations";
import EventOperations from "@/components/EventOperations";

// Work: the team's daily page. Each person sees the properties they work at, their duties, and can send a
// shift report. Owners and managers also assign duties, see everyone's duties and read every report.

interface WorkProp { id: string; title: string; role: string; hire_category: string | null }
interface Duty { id: string; title: string; details: string | null; priority: string; status: string; assigned_to: string; assigned_to_name: string | null; assigned_by_name: string | null; created_at: string; due_at: string | null; completed_at: string | null; completed_note: string | null; cancelled_at: string | null; overdue: boolean }
interface Report { id: string; author_name: string | null; shift: string; body: string; created_at: string }
interface Assignee { id: string; name: string; role: string }

const pretty = (s: string) => s.replace(/_/g, " ");

export default function WorkPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [props, setProps] = useState<WorkProp[] | null>(null);
  const [pid, setPid] = useState<string>("");
  const [duties, setDuties] = useState<Duty[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dTitle, setDTitle] = useState(""); const [dDetails, setDDetails] = useState(""); const [dTo, setDTo] = useState("");
  const [dPriority, setDPriority] = useState("normal"); const [dDue, setDDue] = useState("");
  const [rShift, setRShift] = useState("day"); const [rBody, setRBody] = useState("");

  const current = props?.find((p) => p.id === pid) || null;
  const isLead = current?.role === "owner" || current?.role === "manager";

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    supabase.rpc("get_my_work_properties").then(({ data, error }) => {
      if (error) { setErr(error.message); return; }
      const list = (data as WorkProp[]) || [];
      setProps(list);
      if (list.length) setPid(list[0].id);
    });
  }, [authLoading, session, router]);

  const loadAll = useCallback(async () => {
    if (!pid) return;
    const lead = props?.find((p) => p.id === pid)?.role;
    const wantAll = (lead === "owner" || lead === "manager") && scope === "all";
    const [d, r] = await Promise.all([
      supabase.rpc("get_duties", { p_property_id: pid, p_scope: wantAll ? "all" : "mine" }),
      supabase.rpc("get_staff_reports", { p_property_id: pid, p_limit: 30 }),
    ]);
    if (d.error) setErr(d.error.message); else setDuties(d.data as Duty[]);
    if (!r.error) setReports(r.data as Report[]);
    if (lead === "owner" || lead === "manager") {
      const a = await supabase.rpc("get_duty_assignees", { p_property_id: pid });
      if (!a.error) setAssignees(a.data as Assignee[]);
    } else setAssignees([]);
  }, [pid, props, scope]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  async function run(fn: PromiseLike<{ error: { message: string } | null }>, ok: string, after?: () => void) {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await fn;
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(ok); after?.(); loadAll();
  }

  function renderDuty(d: Duty) {
    const mine = d.assigned_to === session?.user.id;
    return (
      <div key={d.id} className="border border-gray-200 rounded-lg p-2 bg-white">
        <div className="flex justify-between gap-2">
          <p className={`text-xs font-semibold text-chs-charcoal ${d.status !== "open" ? "line-through opacity-60" : ""}`}>{d.title}</p>
          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full whitespace-nowrap ${d.status === "done" ? "bg-green-100 text-green-700" : d.status === "cancelled" ? "bg-gray-200 text-gray-600" : d.overdue ? "bg-red-100 text-red-700" : d.priority === "urgent" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
            {d.status === "open" ? (d.overdue ? "overdue" : d.priority) : d.status}
          </span>
        </div>
        {d.details && <p className="text-[10px] text-gray-500">{d.details}</p>}
        <p className="text-[10px] text-gray-400">
          For {d.assigned_to_name || "—"} · from {d.assigned_by_name || "—"} · given {formatDateTime(d.created_at)}
          {d.due_at ? ` · due ${formatDateTime(d.due_at)}` : ""}
          {d.completed_at ? ` · done ${formatDateTime(d.completed_at)}` : ""}
          {d.cancelled_at ? ` · cancelled ${formatDateTime(d.cancelled_at)}` : ""}
          {d.completed_note ? ` · ${d.completed_note}` : ""}
        </p>
        {d.status === "open" && (
          <div className="flex gap-1 mt-1.5">
            {(mine || isLead) && <button disabled={busy} onClick={() => { const n = window.prompt("Any note? (optional)", "") ; if (n === null) return; run(supabase.rpc("complete_duty", { p_duty_id: d.id, p_note: n || null }), "Duty marked done."); }} className="text-[10px] px-2 py-1 rounded-full bg-green-600 text-white">Mark done</button>}
            {isLead && <button disabled={busy} onClick={() => { if (window.confirm("Cancel this duty?")) run(supabase.rpc("cancel_duty", { p_duty_id: d.id }), "Duty cancelled."); }} className="text-[10px] px-2 py-1 rounded-full border border-gray-300">Cancel</button>}
          </div>
        )}
      </div>
    );
  }

  if (authLoading || props === null) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/host" className="text-xs text-white/70">← Host dashboard</Link>
        <h1 className="font-serif text-lg font-bold mt-1">📋 Work</h1>
        <p className="text-xs text-white/60 mt-1">Your duties, shift reports and the day&apos;s operations.</p>
      </div>
      <div className="px-4 py-4 space-y-3 max-w-md mx-auto">
        {props.length === 0 ? (
          <p className="text-xs text-gray-500">You are not on any property&apos;s team yet. A hotel or event-centre owner can add you by your phone number.</p>
        ) : (
          <>
            {props.length > 1 && (
              <select value={pid} onChange={(e) => setPid(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {props.map((p) => <option key={p.id} value={p.id}>{p.title} · {pretty(p.role)}</option>)}
              </select>
            )}
            {current && <p className="text-xs text-gray-500">{current.title} · you are: <b>{pretty(current.role)}</b></p>}
            {msg && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{msg}</p>}
            {err && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{err}</p>}

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-chs-charcoal">Duties</p>
              {isLead && (
                <div className="flex gap-1">
                  {(["mine", "all"] as const).map((s) => <button key={s} onClick={() => setScope(s)} className={`text-[10px] px-2 py-1 rounded-full ${scope === s ? "bg-chs-charcoal text-white" : "border border-gray-300"}`}>{s === "mine" ? "Mine" : "Everyone"}</button>)}
                </div>
              )}
            </div>
            {isLead && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1.5">
                <p className="text-[11px] font-bold text-chs-charcoal">Assign a duty</p>
                <input value={dTitle} onChange={(e) => setDTitle(e.target.value)} placeholder="What needs doing? e.g. Set up Hall B for Saturday" className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                <textarea value={dDetails} onChange={(e) => setDDetails(e.target.value)} placeholder="Details (optional)" rows={2} className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                <div className="flex gap-1.5 flex-wrap">
                  <select value={dTo} onChange={(e) => setDTo(e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs">
                    <option value="">Assign to…</option>
                    {assignees.map((a) => <option key={a.id} value={a.id}>{a.name} · {pretty(a.role)}</option>)}
                  </select>
                  <select value={dPriority} onChange={(e) => setDPriority(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs"><option value="low">Low</option><option value="normal">Normal</option><option value="urgent">Urgent</option></select>
                </div>
                <label className="block text-[10px] text-gray-500">Due (optional, Nigerian time)
                  <input type="datetime-local" value={dDue} onChange={(e) => setDDue(e.target.value)} className="block w-full border border-gray-300 rounded px-2 py-1 text-xs mt-0.5" />
                </label>
                <button disabled={busy || !dTitle.trim() || !dTo} onClick={() => run(supabase.rpc("create_duty", { p_property_id: pid, p_assigned_to: dTo, p_title: dTitle, p_details: dDetails || null, p_priority: dPriority, p_due_at: dDue ? new Date(dDue + ":00+01:00").toISOString() : null }), "Duty assigned and the person notified.", () => { setDTitle(""); setDDetails(""); setDDue(""); })} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">Assign duty</button>
              </div>
            )}
            <div className="space-y-1.5">
              {duties.length === 0 ? <p className="text-xs text-gray-400">No duties yet.</p> : duties.map(renderDuty)}
            </div>

            <p className="text-xs font-bold text-chs-charcoal pt-2">Shift report</p>
            <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1.5">
              <select value={rShift} onChange={(e) => setRShift(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs"><option value="morning">Morning shift</option><option value="day">Day shift</option><option value="evening">Evening shift</option><option value="night">Night shift</option></select>
              <textarea value={rBody} onChange={(e) => setRBody(e.target.value)} rows={3} placeholder="What happened this shift? Guests, problems, stock, anything the owner should know." className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
              <button disabled={busy || rBody.trim().length < 10} onClick={() => run(supabase.rpc("submit_staff_report", { p_property_id: pid, p_shift: rShift, p_body: rBody }), "Report sent. The time is recorded.", () => setRBody(""))} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">Send report</button>
            </div>
            <p className="text-[11px] font-bold text-chs-charcoal">{isLead ? "Reports from the team" : "My reports"}</p>
            {reports.length === 0 ? <p className="text-xs text-gray-400">No reports yet.</p> : reports.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-2">
                <p className="text-[10px] text-gray-400">{r.author_name || "—"} · {r.shift} shift · {formatDateTime(r.created_at)}</p>
                <p className="text-xs text-chs-charcoal whitespace-pre-wrap">{r.body}</p>
              </div>
            ))}

            {current && current.hire_category === "event_centre" && <EventOperations propertyId={current.id} />}
            {current && current.hire_category === "hotel_lodge" && <HotelOperations propertyId={current.id} role={current.role} />}
          </>
        )}
      </div>
    </div>
  );
}
