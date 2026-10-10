"use client";

import EventQuoteHost from "@/components/EventQuoteHost";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatCalendarDate, formatDateTime } from "@/lib/format";

// Event-day control for an event centre: every paid, confirmed event with what the client asked for, who is
// providing each service (ushers, caterer, band, security, other), and a run sheet the team ticks off.
// Staff can tick tasks; the owner or a manager manages vendors and assigns tasks.

interface Vendor { id: string; kind: string; name: string; phone: string | null; headcount: number | null; status: string; note: string | null; updated_at: string }
interface Item { id: string; when_label: string | null; title: string; details: string | null; assigned_to_name: string | null; status: string; done_at: string | null; done_by_name: string | null }
interface Ev {
  booking_id: string; event_date: string; event_type: string; tier: string | null; guests: number | null; client: string;
  wants_ushers: boolean; number_of_ushers: number | null; wants_caterer: boolean; wants_band: boolean; wants_security: boolean; number_of_security: number | null; extra: string | null;
  vendors: Vendor[]; items: Item[];
}
interface Board { role: string; events: Ev[] }
interface Assignee { id: string; name: string; role: string }

const KINDS = ["usher", "caterer", "band", "security", "other"];
const kindLabel = (k: string) => (k === "usher" ? "Ushers" : k === "band" ? "Live band" : k === "security" ? "Security" : k === "caterer" ? "Caterer" : "Other");

export default function EventOperations({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openEv, setOpenEv] = useState<string | null>(null);
  const [vk, setVk] = useState("caterer"); const [vn, setVn] = useState(""); const [vp, setVp] = useState(""); const [vh, setVh] = useState("");
  const [tTitle, setTTitle] = useState(""); const [tWhen, setTWhen] = useState(""); const [tTo, setTTo] = useState("");

  const isLead = board?.role === "owner" || board?.role === "manager";

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_event_board", { p_property_id: propertyId });
    if (error) { setErr(error.message); return; }
    const b = data as Board; setBoard(b);
    if (b.role === "owner" || b.role === "manager") {
      const a = await supabase.rpc("get_duty_assignees", { p_property_id: propertyId });
      if (!a.error) setAssignees(a.data as Assignee[]);
    }
  }, [propertyId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && !board) load();
  }, [open, board, load]);

  async function run(fn: PromiseLike<{ error: { message: string } | null }>, ok: string, after?: () => void) {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await fn;
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(ok); after?.(); load();
  }

  function wanted(e: Ev): string[] {
    const w: string[] = [];
    if (e.wants_ushers) w.push(`ushers${e.number_of_ushers ? ` (${e.number_of_ushers})` : ""}`);
    if (e.wants_caterer) w.push("caterer");
    if (e.wants_band) w.push("live band");
    if (e.wants_security) w.push(`security${e.number_of_security ? ` (${e.number_of_security})` : ""}`);
    return w;
  }

  function renderEvent(e: Ev) {
    const done = e.items.filter((i) => i.status !== "todo").length;
    const expanded = openEv === e.booking_id;
    return (
      <div key={e.booking_id} className="border border-gray-200 rounded-lg p-2 bg-white">
        <button type="button" onClick={() => setOpenEv(expanded ? null : e.booking_id)} className="w-full text-left">
          <div className="flex justify-between gap-2">
            <p className="text-xs font-semibold text-chs-charcoal">{e.event_type} · {formatCalendarDate(e.event_date)}</p>
            <span className="text-[10px] text-gray-500">{e.items.length ? `${done}/${e.items.length} tasks` : "no run sheet"}</span>
          </div>
          <p className="text-[10px] text-gray-500">{e.client}{e.guests ? ` · ${e.guests} guests` : ""}{e.tier ? ` · ${e.tier}` : ""}</p>
          {wanted(e).length > 0 && <p className="text-[10px] text-gray-500">Asked for: {wanted(e).join(", ")}</p>}
        </button>
        {expanded && (
          <div className="mt-2 space-y-2">
            {e.extra && <p className="text-[10px] bg-gray-50 rounded p-1.5 text-chs-charcoal">Client note: {e.extra}</p>}
            <EventQuoteHost bookingId={e.booking_id} canSend={isLead} />
            <p className="text-[11px] font-bold text-chs-charcoal">Who is providing what</p>
            {e.vendors.length === 0 && <p className="text-[10px] text-gray-400">No vendor recorded yet.</p>}
            {e.vendors.map((v) => (
              <div key={v.id} className="flex justify-between items-start gap-2 border-b border-gray-100 py-1">
                <p className="text-[11px] text-chs-charcoal">{kindLabel(v.kind)}: <b>{v.name}</b>{v.headcount ? ` ×${v.headcount}` : ""}{v.phone ? ` · ${v.phone}` : ""}<br /><span className="text-[10px] text-gray-400">{v.status} · {formatDateTime(v.updated_at)}{v.note ? ` · ${v.note}` : ""}</span></p>
                {isLead && v.status !== "confirmed" && <button disabled={busy} onClick={() => run(supabase.rpc("set_event_vendor", { p_booking_id: e.booking_id, p_vendor_id: v.id, p_kind: v.kind, p_name: v.name, p_phone: v.phone, p_headcount: v.headcount, p_status: "confirmed", p_note: v.note }), "Confirmed. The client has been told.")} className="text-[10px] px-2 py-0.5 rounded-full bg-green-600 text-white whitespace-nowrap">Confirm</button>}
              </div>
            ))}
            {isLead && (
              <div className="bg-gray-50 rounded p-2 space-y-1">
                <div className="flex gap-1">
                  <select value={vk} onChange={(ev) => setVk(ev.target.value)} className="border border-gray-300 rounded px-1 py-1 text-[11px]">{KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}</select>
                  <input value={vn} onChange={(ev) => setVn(ev.target.value)} placeholder="Name or company" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
                </div>
                <div className="flex gap-1">
                  <input value={vp} onChange={(ev) => setVp(ev.target.value)} placeholder="Phone (only you see it)" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
                  <input value={vh} onChange={(ev) => setVh(ev.target.value.replace(/\D/g, ""))} placeholder="How many" className="w-20 border border-gray-300 rounded px-2 py-1 text-[11px]" />
                </div>
                <button disabled={busy || !vn.trim()} onClick={() => run(supabase.rpc("set_event_vendor", { p_booking_id: e.booking_id, p_vendor_id: null, p_kind: vk, p_name: vn, p_phone: vp || null, p_headcount: vh ? Number(vh) : null, p_status: "requested", p_note: null }), "Vendor added.", () => { setVn(""); setVp(""); setVh(""); })} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Add vendor</button>
              </div>
            )}
            <p className="text-[11px] font-bold text-chs-charcoal">Run sheet</p>
            {e.items.length === 0 ? (
              <button disabled={busy} onClick={() => run(supabase.rpc("ensure_run_sheet", { p_booking_id: e.booking_id }), "Run sheet created from what the client asked for.")} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Create the run sheet</button>
            ) : e.items.map((i) => (
              <div key={i.id} className="flex items-start gap-2 border-b border-gray-100 py-1">
                <input type="checkbox" checked={i.status === "done"} disabled={busy || i.status === "skipped"} onChange={(ev) => run(supabase.rpc("set_run_item_status", { p_item_id: i.id, p_status: ev.target.checked ? "done" : "todo" }), ev.target.checked ? "Task ticked." : "Task re-opened.")} className="mt-0.5" />
                <div className="flex-1">
                  <p className={`text-[11px] text-chs-charcoal ${i.status !== "todo" ? "line-through opacity-60" : ""}`}>{i.title}{i.when_label ? <span className="text-gray-400"> · {i.when_label}</span> : null}{i.assigned_to_name ? <span className="text-gray-500"> · for {i.assigned_to_name}</span> : null}</p>
                  {i.details && <p className="text-[10px] text-gray-400">{i.details}</p>}
                  {i.done_at && <p className="text-[10px] text-gray-400">{i.status === "skipped" ? "Skipped" : "Done"} {formatDateTime(i.done_at)}{i.done_by_name ? ` by ${i.done_by_name}` : ""}</p>}
                </div>
                {isLead && i.status === "todo" && <button disabled={busy} onClick={() => run(supabase.rpc("set_run_item_status", { p_item_id: i.id, p_status: "skipped" }), "Task skipped.")} className="text-[10px] underline text-gray-500">Skip</button>}
              </div>
            ))}
            {e.items.length > 0 && (
              <div className="bg-gray-50 rounded p-2 space-y-1">
                <input value={tTitle} onChange={(ev) => setTTitle(ev.target.value)} placeholder="Add a task" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
                <div className="flex gap-1">
                  <input value={tWhen} onChange={(ev) => setTWhen(ev.target.value)} placeholder="When, e.g. 7 am" className="flex-1 border border-gray-300 rounded px-2 py-1 text-[11px]" />
                  {isLead && <select value={tTo} onChange={(ev) => setTTo(ev.target.value)} className="flex-1 border border-gray-300 rounded px-1 py-1 text-[11px]"><option value="">Anyone</option>{assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
                </div>
                <button disabled={busy || !tTitle.trim()} onClick={() => run(supabase.rpc("add_run_item", { p_booking_id: e.booking_id, p_title: tTitle, p_details: null, p_when_label: tWhen || null, p_assigned_to: tTo || null }), "Task added.", () => { setTTitle(""); setTWhen(""); setTTo(""); })} className="px-3 py-1 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold disabled:opacity-50">Add task</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 border border-gray-200 rounded-lg">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex justify-between items-center px-3 py-2 text-xs font-bold text-chs-charcoal">
        <span>🎉 Event day control: vendors &amp; run sheet</span><span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {msg && <p className="text-[11px] text-green-700">{msg}</p>}
          {err && <p className="text-[11px] text-red-600">{err}</p>}
          {!board ? <p className="text-[11px] text-gray-400">Loading…</p> : board.events.length === 0 ? <p className="text-[11px] text-gray-400">No paid, confirmed events coming up.</p> : board.events.map(renderEvent)}
        </div>
      )}
    </div>
  );
}
