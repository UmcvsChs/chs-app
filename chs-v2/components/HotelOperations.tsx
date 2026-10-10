"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateTime, formatNaira } from "@/lib/format";
import HotelImportSync from "@/components/HotelImportSync";
import HotelServices from "@/components/HotelServices";

// Hotel back office for one listing: housekeeping board, maintenance tickets and money (other income
// centres, expenses, owner report, ledger). Staff can run housekeeping, maintenance and record income;
// expenses, voids, the report and the ledger are owner-only (enforced in the database, not just here).

type Tab = "housekeeping" | "maintenance" | "money" | "services" | "import";

interface Room { unit_id: string; label: string; room_type: string | null; effective_status: string; status_at: string | null; status_by_name: string | null; note: string | null; open_tickets: number; departing_today: boolean; arriving_today: boolean }
interface HkBoard { summary: { rooms: number; dirty: number; occupied: number; clean: number; out_of_order: number; open_tickets: number }; rooms: Room[]; generated_at: string }
interface Ticket { id: string; room: string | null; title: string; details: string | null; priority: string; status: string; cost: number | null; reported_by: string | null; created_at: string; updated_at: string | null; resolved_at: string | null; resolution_note: string | null }
interface Report {
  from: string; to: string; rooms: number; nights_available: number; nights_sold: number; bookings: number; occupancy_pct: number;
  room_revenue: number; chs_commission: number; room_net: number; adr: number; revpar: number;
  other_income: { centre: string; entries: number; total: number }[]; other_income_total: number;
  expenses: { category: string; entries: number; total: number }[]; expenses_total: number; maintenance_cost: number; net_result: number; generated_at: string;
}
interface LedgerRow { kind: string; id: string; recorded_at: string; happened_at: string; label: string; amount: number; direction: "in" | "out"; by: string | null; voided_at: string | null; void_reason: string | null }

const STATUS_STYLE: Record<string, string> = {
  dirty: "bg-red-100 text-red-700", clean: "bg-green-100 text-green-700", inspected: "bg-emerald-100 text-emerald-800",
  occupied: "bg-blue-100 text-blue-700", out_of_order: "bg-gray-300 text-gray-700",
};
const CENTRES = ["restaurant", "bar", "laundry", "gym", "events", "walk_in_rooms", "other"];
const CATEGORIES = ["salaries", "utilities", "food_drink", "supplies", "repairs", "marketing", "taxes_fees", "other"];
const pretty = (s: string) => s.replace(/_/g, " ");
const lagosToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
const lagosDaysAgo = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

export default function HotelOperations({ propertyId, role = "owner" }: { propertyId: string; role?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("housekeeping");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState<HkBoard | null>(null);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [moneyErr, setMoneyErr] = useState<string | null>(null);
  const [from, setFrom] = useState(lagosDaysAgo(29));
  const [to, setTo] = useState(lagosToday());
  // forms
  const [tkTitle, setTkTitle] = useState(""); const [tkDetails, setTkDetails] = useState("");
  const [tkUnit, setTkUnit] = useState(""); const [tkPriority, setTkPriority] = useState("normal");
  const [inCentre, setInCentre] = useState("restaurant"); const [inAmount, setInAmount] = useState(""); const [inDesc, setInDesc] = useState("");
  const [exCat, setExCat] = useState("supplies"); const [exAmount, setExAmount] = useState(""); const [exDesc, setExDesc] = useState("");

  const loadBoard = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_housekeeping_board", { p_property_id: propertyId });
    if (error) setErr(error.message); else setBoard(data as HkBoard);
  }, [propertyId]);
  const loadTickets = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_maintenance_tickets", { p_property_id: propertyId });
    if (error) setErr(error.message); else setTickets(data as Ticket[]);
  }, [propertyId]);
  const loadMoney = useCallback(async () => {
    setMoneyErr(null);
    const [r, l] = await Promise.all([
      supabase.rpc("get_hotel_report", { p_property_id: propertyId, p_from: from, p_to: to }),
      supabase.rpc("get_hotel_ledger", { p_property_id: propertyId, p_from: from, p_to: to }),
    ]);
    if (r.error || l.error) { setReport(null); setLedger(null); setMoneyErr((r.error || l.error)!.message); return; }
    setReport(r.data as Report); setLedger(l.data as LedgerRow[]);
  }, [propertyId, from, to]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "housekeeping") loadBoard();
    if (tab === "maintenance") { loadTickets(); if (!board) loadBoard(); }
    if (tab === "money") loadMoney();
  }, [open, tab, loadBoard, loadTickets, loadMoney, board]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string, after: () => void) {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(ok); after();
  }

  function downloadCsv() {
    if (!ledger) return;
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["When (WAT)", "Recorded (WAT)", "Type", "Description", "In/Out", "Amount (NGN)", "By", "Voided at (WAT)", "Void reason"].map(esc).join(",")];
    ledger.forEach((r) => lines.push([formatDateTime(r.happened_at), formatDateTime(r.recorded_at), r.kind, r.label, r.direction, r.amount, r.by, r.voided_at ? formatDateTime(r.voided_at) : "", r.void_reason].map(esc).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `hotel-ledger-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  function renderHousekeeping() {
    if (!board) return <p className="text-[11px] text-gray-400">Loading…</p>;
    const s = board.summary;
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-gray-500">{s.rooms} rooms · {s.dirty} to clean · {s.occupied} occupied · {s.clean} ready · {s.out_of_order} out of order · {s.open_tickets} open repairs</p>
        {board.rooms.map((r) => (
          <div key={r.unit_id} className="border border-gray-200 rounded-lg p-2">
            <div className="flex justify-between items-center">
              <p className="text-xs font-semibold text-chs-charcoal">{r.label}{r.room_type ? ` · ${r.room_type}` : ""}</p>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${STATUS_STYLE[r.effective_status] || "bg-gray-100"}`}>{pretty(r.effective_status)}</span>
            </div>
            {(r.departing_today || r.arriving_today || r.open_tickets > 0) && (
              <p className="text-[10px] text-gray-500">{r.departing_today ? "Guest leaves today · " : ""}{r.arriving_today ? "Guest arrives today · " : ""}{r.open_tickets > 0 ? `${r.open_tickets} open repair(s)` : ""}</p>
            )}
            {r.status_at && <p className="text-[10px] text-gray-400">Last set {formatDateTime(r.status_at)}{r.status_by_name ? ` by ${r.status_by_name}` : ""}{r.note ? ` · ${r.note}` : ""}</p>}
            {r.effective_status !== "occupied" && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {(["dirty", "clean", "inspected", "out_of_order"] as const).map((st) => (
                  <button key={st} disabled={busy} onClick={() => run(() => supabase.rpc("set_room_status", { p_unit_id: r.unit_id, p_status: st, p_note: null }), `${r.label} marked ${pretty(st)}.`, loadBoard)}
                    className="text-[10px] px-2 py-1 rounded-full border border-gray-300 text-chs-charcoal disabled:opacity-50">{st === "clean" ? "Cleaned" : pretty(st)}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderMaintenance() {
    return (
      <div className="space-y-2">
        <div className="border border-gray-200 rounded-lg p-2 space-y-1.5">
          <p className="text-[11px] font-bold text-chs-charcoal">Report a fault</p>
          <input value={tkTitle} onChange={(e) => setTkTitle(e.target.value)} placeholder="What is wrong? e.g. Leaking tap" className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
          <textarea value={tkDetails} onChange={(e) => setTkDetails(e.target.value)} placeholder="Details (optional)" className="w-full border border-gray-300 rounded px-2 py-1 text-xs" rows={2} />
          <div className="flex gap-1.5">
            <select value={tkUnit} onChange={(e) => setTkUnit(e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs">
              <option value="">General (no room)</option>
              {board?.rooms.map((r) => <option key={r.unit_id} value={r.unit_id}>{r.label}</option>)}
            </select>
            <select value={tkPriority} onChange={(e) => setTkPriority(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs">
              <option value="low">Low</option><option value="normal">Normal</option><option value="urgent">Urgent (alerts owner)</option>
            </select>
          </div>
          <button disabled={busy || !tkTitle.trim()} onClick={() => run(() => supabase.rpc("create_maintenance_ticket", { p_property_id: propertyId, p_unit_id: tkUnit || null, p_title: tkTitle, p_details: tkDetails || null, p_priority: tkPriority }), "Fault logged.", () => { setTkTitle(""); setTkDetails(""); loadTickets(); })}
            className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">Log fault</button>
        </div>
        {!tickets ? <p className="text-[11px] text-gray-400">Loading…</p> : tickets.length === 0 ? <p className="text-[11px] text-gray-400">No faults logged yet.</p> : tickets.map((t) => (
          <div key={t.id} className="border border-gray-200 rounded-lg p-2">
            <div className="flex justify-between">
              <p className="text-xs font-semibold text-chs-charcoal">{t.title}{t.room ? ` · ${t.room}` : ""}</p>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${t.status === "done" ? "bg-green-100 text-green-700" : t.priority === "urgent" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{t.status === "done" ? "done" : `${pretty(t.status)} · ${t.priority}`}</span>
            </div>
            {t.details && <p className="text-[10px] text-gray-500">{t.details}</p>}
            <p className="text-[10px] text-gray-400">Logged {formatDateTime(t.created_at)}{t.reported_by ? ` by ${t.reported_by}` : ""}{t.resolved_at ? ` · Fixed ${formatDateTime(t.resolved_at)}` : ""}{t.cost ? ` · Cost ${formatNaira(t.cost)}` : ""}{t.resolution_note ? ` · ${t.resolution_note}` : ""}</p>
            {t.status !== "done" && (
              <div className="flex gap-1 mt-1.5">
                {t.status === "open" && <button disabled={busy} onClick={() => run(() => supabase.rpc("update_maintenance_ticket", { p_ticket_id: t.id, p_status: "in_progress", p_cost: null, p_note: null }), "Marked in progress.", loadTickets)} className="text-[10px] px-2 py-1 rounded-full border border-gray-300">Start work</button>}
                <button disabled={busy} onClick={() => {
                  const c = window.prompt("What did the repair cost in naira? (0 if nothing)", "0");
                  if (c === null) return;
                  const cost = Number(c.replace(/,/g, ""));
                  if (isNaN(cost) || cost < 0) { setErr("Enter a valid amount."); return; }
                  const note = window.prompt("Short note on what was done (optional)", "") || null;
                  run(() => supabase.rpc("update_maintenance_ticket", { p_ticket_id: t.id, p_status: "done", p_cost: cost, p_note: note }), "Repair marked done.", loadTickets);
                }} className="text-[10px] px-2 py-1 rounded-full bg-green-600 text-white">Mark done</button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderMoney() {
    return (
      <div className="space-y-3">
        <div className="border border-gray-200 rounded-lg p-2 space-y-1.5">
          <p className="text-[11px] font-bold text-chs-charcoal">Record income (restaurant, bar, laundry, gym, events…)</p>
          <div className="flex gap-1.5">
            <select value={inCentre} onChange={(e) => setInCentre(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs">{CENTRES.map((c) => <option key={c} value={c}>{pretty(c)}</option>)}</select>
            <input value={inAmount} onChange={(e) => setInAmount(e.target.value)} inputMode="numeric" placeholder="Amount ₦" className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" />
          </div>
          <input value={inDesc} onChange={(e) => setInDesc(e.target.value)} placeholder="What for? (optional)" className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
          <button disabled={busy || !inAmount} onClick={() => run(() => supabase.rpc("add_hotel_income", { p_property_id: propertyId, p_centre: inCentre, p_amount: Number(inAmount.replace(/,/g, "")), p_description: inDesc || null }), "Income recorded with today's date and time.", () => { setInAmount(""); setInDesc(""); loadMoney(); })}
            className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">Record income</button>
        </div>
        <div className="border border-gray-200 rounded-lg p-2 space-y-1.5">
          <p className="text-[11px] font-bold text-chs-charcoal">Record expense (owner, manager or accountant)</p>
          <div className="flex gap-1.5">
            <select value={exCat} onChange={(e) => setExCat(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs">{CATEGORIES.map((c) => <option key={c} value={c}>{pretty(c)}</option>)}</select>
            <input value={exAmount} onChange={(e) => setExAmount(e.target.value)} inputMode="numeric" placeholder="Amount ₦" className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" />
          </div>
          <input value={exDesc} onChange={(e) => setExDesc(e.target.value)} placeholder="What for? (optional)" className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
          <button disabled={busy || !exAmount} onClick={() => run(() => supabase.rpc("add_hotel_expense", { p_property_id: propertyId, p_category: exCat, p_amount: Number(exAmount.replace(/,/g, "")), p_description: exDesc || null }), "Expense recorded.", () => { setExAmount(""); setExDesc(""); loadMoney(); })}
            className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">Record expense</button>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap">
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs" />
          <span className="text-[11px] text-gray-400">to</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs" />
        </div>
        {moneyErr && <p className="text-[11px] text-gray-500">{moneyErr.includes("owner") || moneyErr.includes("permission") || moneyErr.includes("access") ? "The report and ledger are for the owner, a manager or the accountant." : moneyErr}</p>}
        {report && (
          <div className="bg-gray-50 rounded-lg p-2 space-y-1">
            <p className="text-[11px] font-bold text-chs-charcoal">Report · {report.from} to {report.to}</p>
            <p className="text-[11px] text-gray-600">Occupancy {report.occupancy_pct}% · {report.nights_sold} of {report.nights_available} room-nights · {report.bookings} bookings</p>
            <p className="text-[11px] text-gray-600">Average room rate {formatNaira(report.adr)} · Revenue per available room {formatNaira(report.revpar)}</p>
            <p className="text-[11px] text-gray-600">Room revenue {formatNaira(report.room_revenue)} − CHS commission {formatNaira(report.chs_commission)} = {formatNaira(report.room_net)}</p>
            <p className="text-[11px] text-gray-600">Other income {formatNaira(report.other_income_total)}{report.other_income.length ? ` (${report.other_income.map((o) => `${pretty(o.centre)} ${formatNaira(o.total)}`).join(", ")})` : ""}</p>
            <p className="text-[11px] text-gray-600">Expenses {formatNaira(report.expenses_total)}{report.expenses.length ? ` (${report.expenses.map((o) => `${pretty(o.category)} ${formatNaira(o.total)}`).join(", ")})` : ""} · Repairs {formatNaira(report.maintenance_cost)}</p>
            <p className={`text-xs font-bold ${report.net_result < 0 ? "text-red-600" : "text-green-700"}`}>Net result {report.net_result < 0 ? "−" : ""}{formatNaira(Math.abs(report.net_result))}</p>
            <p className="text-[10px] text-gray-400">Generated {formatDateTime(report.generated_at)}</p>
          </div>
        )}
        {ledger && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-[11px] font-bold text-chs-charcoal">Ledger (newest first)</p>
              <button onClick={downloadCsv} className="text-[10px] px-2 py-1 rounded-full border border-gray-300">Download CSV</button>
            </div>
            {ledger.length === 0 ? <p className="text-[11px] text-gray-400">Nothing recorded in this period.</p> : ledger.map((r) => (
              <div key={`${r.kind}-${r.id}`} className={`border-b border-gray-100 py-1.5 ${r.voided_at ? "opacity-60" : ""}`}>
                <div className="flex justify-between gap-2">
                  <p className={`text-[11px] text-chs-charcoal ${r.voided_at ? "line-through" : ""}`}>{r.label}</p>
                  <p className={`text-[11px] font-semibold whitespace-nowrap ${r.direction === "in" ? "text-green-700" : "text-red-600"}`}>{r.direction === "in" ? "+" : "−"}{formatNaira(r.amount)}</p>
                </div>
                <p className="text-[10px] text-gray-400">{formatDateTime(r.happened_at)}{r.by ? ` · ${r.by}` : ""}{r.voided_at ? ` · VOIDED ${formatDateTime(r.voided_at)}: ${r.void_reason}` : ""}</p>
                {!r.voided_at && (r.kind === "income" || r.kind === "expense") && (
                  <button disabled={busy} onClick={() => { const why = window.prompt("Why are you voiding this entry? It stays visible on the ledger, marked voided."); if (why && why.trim()) run(() => supabase.rpc("void_hotel_entry", { p_kind: r.kind, p_id: r.id, p_reason: why }), "Entry voided.", loadMoney); }} className="text-[10px] text-red-600 underline">Void</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 border border-gray-200 rounded-lg">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex justify-between items-center px-3 py-2 text-xs font-bold text-chs-charcoal">
        <span>🏨 Hotel operations: housekeeping, repairs &amp; money</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex gap-1">
            {([["housekeeping", "🧹 Housekeeping"], ["maintenance", "🔧 Repairs"], ["money", "💰 Money"], ["services", "🍽️ Menu & stock"], ["import", "📥 Import & sync"]] as [Tab, string][]).map(([k, label]) => (
              <button key={k} onClick={() => { setTab(k); setMsg(null); setErr(null); }} className={`flex-1 text-[11px] font-semibold py-1.5 rounded-full ${tab === k ? "bg-chs-charcoal text-white" : "border border-gray-300 text-chs-charcoal"}`}>{label}</button>
            ))}
          </div>
          {msg && <p className="text-[11px] text-green-700">{msg}</p>}
          {err && <p className="text-[11px] text-red-600">{err}</p>}
          {tab === "housekeeping" && renderHousekeeping()}
          {tab === "maintenance" && renderMaintenance()}
          {tab === "money" && renderMoney()}
          {tab === "services" && <HotelServices propertyId={propertyId} role={role} />}
          {tab === "import" && <HotelImportSync propertyId={propertyId} role={role} />}
        </div>
      )}
    </div>
  );
}
