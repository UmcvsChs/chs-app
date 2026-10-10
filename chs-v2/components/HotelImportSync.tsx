"use client";

import { useCallback, useEffect, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import { FIELDS, buildRows, guessMapping, parseCsv, type BuiltRow, type ImportKind } from "@/lib/importMapping";

// Bring what you already have onto CHS: (1) import rooms, income or expenses from an Excel or CSV sheet with a
// preview and an Undo; (2) a calendar link per room that other sites can read, and links to other sites'
// calendars that CHS reads, so a room booked elsewhere is blocked here too.

interface Source { id: string; name: string; room: string; unit_id: string; domain: string; active: boolean; last_synced_at: string | null; last_status: string | null; last_added: number | null; last_conflicts: number | null }
interface Batch { id: string; kind: string; label: string | null; rows_added: number; rows_skipped: number; by: string | null; created_at: string; undone_at: string | null }
interface Unit { unit_id: string; label: string }

const KIND_LABEL: Record<ImportKind, string> = { rooms: "Rooms and prices", income: "Income (restaurant, bar, laundry…)", expense: "Expenses" };

export default function HotelImportSync({ propertyId, role }: { propertyId: string; role: string }) {
  const isLead = role === "owner" || role === "manager";
  const [kind, setKind] = useState<ImportKind>(isLead ? "rooms" : "income");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [built, setBuilt] = useState<BuiltRow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [srcUnit, setSrcUnit] = useState(""); const [srcName, setSrcName] = useState(""); const [srcUrl, setSrcUrl] = useState("");
  const [feedUnit, setFeedUnit] = useState(""); const [feedUrl, setFeedUrl] = useState("");

  const load = useCallback(async () => {
    const b = await supabase.rpc("get_import_batches", { p_property_id: propertyId });
    if (!b.error) setBatches(b.data as Batch[]);
    if (isLead) {
      const [s, h] = await Promise.all([
        supabase.rpc("list_calendar_sources", { p_property_id: propertyId }),
        supabase.rpc("get_housekeeping_board", { p_property_id: propertyId }),
      ]);
      if (!s.error) setSources(s.data as Source[]);
      if (!h.error) setUnits((h.data as { rooms: Unit[] }).rooms);
    }
  }, [propertyId, isLead]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function recompute(k: ImportKind, d: unknown[][], m: Record<string, number>) { setBuilt(buildRows(k, d, m)); }

  async function onFile(f: File | undefined) {
    setErr(null); setMsg(null);
    if (!f) return;
    if (f.size > 5_000_000) { setErr("That file is too large. Keep it under 5 MB."); return; }
    try {
      let rows: unknown[][];
      if (/\.csv$|\.txt$/i.test(f.name)) rows = parseCsv(await f.text());
      else if (/\.xlsx$/i.test(f.name)) rows = (await readSheet(f)) as unknown[][];
      else { setErr("Please choose an .xlsx (Excel) or .csv file. For an old .xls file, open it in Excel and Save As .xlsx."); return; }
      rows = rows.filter((r) => r.some((c) => c !== null && c !== "" && c !== undefined));
      if (rows.length < 2) { setErr("The sheet needs a heading row and at least one row of data."); return; }
      if (rows.length > 1001) { setErr("Import up to 1000 rows at a time. Split the sheet and import it in parts."); return; }
      const hs = rows[0].map((c) => String(c ?? ""));
      const body = rows.slice(1);
      const m = guessMapping(kind, hs);
      setFileName(f.name); setHeaders(hs); setData(body); setMapping(m); recompute(kind, body, m);
    } catch {
      setErr("Could not read that file. Check it is not password-protected.");
    }
  }

  function changeKind(k: ImportKind) {
    setKind(k); setFileName(""); setHeaders([]); setData([]); setBuilt([]); setMapping({});
  }
  function changeMap(key: string, idx: number) { const m = { ...mapping, [key]: idx }; setMapping(m); recompute(kind, data, m); }

  const missing = FIELDS[kind].filter((f) => f.required && (mapping[f.key] ?? -1) < 0);
  const good = built.filter((b) => !b.problem);
  const bad = built.filter((b) => b.problem);

  async function confirmImport() {
    setBusy(true); setErr(null); setMsg(null);
    const { data: r, error } = await supabase.rpc("import_hotel_rows", { p_property_id: propertyId, p_kind: kind, p_rows: good.map((g) => g.row), p_label: fileName });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const res = r as { added: number; skipped: number; problems: { row: number; problem: string }[] };
    setMsg(`Imported ${res.added} row(s)${res.skipped ? `, ${res.skipped} skipped (already there or not valid)` : ""}. You can undo it below.`);
    setFileName(""); setHeaders([]); setData([]); setBuilt([]);
    load();
  }

  async function undo(id: string) {
    if (!window.confirm("Undo this import? Imported rooms are switched off and imported money entries are voided (they stay visible, marked voided).")) return;
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("undo_hotel_import", { p_batch_id: id });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("Import undone."); load();
  }

  async function addSource() {
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("add_calendar_source", { p_unit_id: srcUnit, p_name: srcName, p_url: srcUrl });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSrcName(""); setSrcUrl(""); setMsg("Calendar linked. Tap Sync now to bring its booked dates in."); load();
  }

  async function syncNow(id: string) {
    setBusy(true); setErr(null); setMsg(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch("/api/calendar-sync", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token || ""}` }, body: JSON.stringify({ source_id: id }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || j.ok === false) { setErr(j.error || "Sync failed."); load(); return; }
    setMsg(`Synced: ${j.added} new blocked period(s)${j.conflicts ? `, ${j.conflicts} clashed with existing bookings and were NOT added, please check them` : ""}${j.stale ? `. ${j.stale} blocked period(s) are no longer on that calendar: release them from Rooms & calendar if the booking was cancelled` : ""}.`);
    load();
  }

  async function showFeed() {
    setErr(null);
    const { data: tok, error } = await supabase.rpc("get_unit_ical_token", { p_unit_id: feedUnit });
    if (error) { setErr(error.message); return; }
    setFeedUrl(`${window.location.origin}/api/ical/${tok}.ics`);
  }

  function renderImport() {
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-gray-500">Already keep your rooms or daily takings in Excel? Upload the sheet. You see a preview first and nothing is saved until you confirm.</p>
        <div className="flex gap-1 flex-wrap">
          {(["rooms", "income", "expense"] as ImportKind[]).filter((k) => k === "rooms" ? isLead : true).map((k) => (
            <button key={k} onClick={() => changeKind(k)} className={`text-[10px] px-2 py-1 rounded-full ${kind === k ? "bg-chs-charcoal text-white" : "border border-gray-300"}`}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400">Needs a heading row. Columns: {FIELDS[kind].map((f) => f.label + (f.required ? "*" : "")).join(", ")}. Dates are read day-first (03/09/2026 = 3 September).</p>
        <input type="file" accept=".xlsx,.csv,.txt" onChange={(e) => onFile(e.target.files?.[0])} className="text-[11px]" />
        {fileName && (
          <div className="bg-gray-50 rounded-lg p-2 space-y-1.5">
            <p className="text-[11px] font-bold text-chs-charcoal">{fileName} · {data.length} row(s)</p>
            <p className="text-[10px] text-gray-500">We matched your columns. Fix any that are wrong:</p>
            {FIELDS[kind].map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="text-[10px] w-32 text-chs-charcoal">{f.label}{f.required ? "*" : ""}</span>
                <select value={mapping[f.key] ?? -1} onChange={(e) => changeMap(f.key, Number(e.target.value))} className="flex-1 border border-gray-300 rounded px-1 py-0.5 text-[11px]">
                  <option value={-1}>— none —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </div>
            ))}
            {missing.length > 0 && <p className="text-[10px] text-red-600">Pick a column for: {missing.map((m) => m.label).join(", ")}.</p>}
            <p className="text-[11px] text-chs-charcoal"><b>{good.length}</b> row(s) ready{bad.length ? `, ${bad.length} with a problem (they will be left out)` : ""}.</p>
            <div className="max-h-40 overflow-auto border border-gray-200 rounded bg-white">
              {built.slice(0, 8).map((b, i) => (
                <p key={i} className={`text-[10px] px-2 py-1 border-b border-gray-100 ${b.problem ? "text-red-600" : "text-chs-charcoal"}`}>
                  {Object.values(b.row).filter(Boolean).join(" · ")}{b.problem ? ` ← ${b.problem}` : ""}
                </p>
              ))}
            </div>
            <button disabled={busy || missing.length > 0 || good.length === 0} onClick={confirmImport} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">Import {good.length} row(s)</button>
          </div>
        )}
        {batches.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-chs-charcoal mt-1">Past imports</p>
            {batches.map((b) => (
              <div key={b.id} className="flex justify-between items-start gap-2 border-b border-gray-100 py-1">
                <p className="text-[10px] text-gray-600">{b.kind} · {b.rows_added} added{b.rows_skipped ? `, ${b.rows_skipped} skipped` : ""} · {b.label || "file"}<br /><span className="text-gray-400">{formatDateTime(b.created_at)}{b.by ? ` · ${b.by}` : ""}{b.undone_at ? ` · UNDONE ${formatDateTime(b.undone_at)}` : ""}</span></p>
                {isLead && !b.undone_at && <button disabled={busy} onClick={() => undo(b.id)} className="text-[10px] text-red-600 underline whitespace-nowrap">Undo</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderSync() {
    if (!isLead) return <p className="text-[11px] text-gray-500">Calendar sync is for the owner or a manager.</p>;
    return (
      <div className="space-y-3">
        <div className="border border-gray-200 rounded-lg p-2 space-y-1.5">
          <p className="text-[11px] font-bold text-chs-charcoal">Share a room&apos;s calendar with other sites</p>
          <p className="text-[10px] text-gray-500">Paste the link into Booking.com, Airbnb or Google Calendar so they see the nights booked on CHS. It shows dates only, never guest details. Keep the link private.</p>
          <div className="flex gap-1.5">
            <select value={feedUnit} onChange={(e) => { setFeedUnit(e.target.value); setFeedUrl(""); }} className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"><option value="">Choose a room…</option>{units.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.label}</option>)}</select>
            <button disabled={!feedUnit} onClick={showFeed} className="px-3 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">Get link</button>
          </div>
          {feedUrl && <input readOnly value={feedUrl} onFocus={(e) => e.currentTarget.select()} className="w-full border border-gray-300 rounded px-2 py-1 text-[10px] font-mono" />}
        </div>
        <div className="border border-gray-200 rounded-lg p-2 space-y-1.5">
          <p className="text-[11px] font-bold text-chs-charcoal">Bring another site&apos;s bookings into CHS</p>
          <p className="text-[10px] text-gray-500">Paste the calendar (.ics) link that Booking.com, Airbnb or your own system gives you. Dates booked there become blocked here, so a room cannot be sold twice. It refreshes by itself whenever you open the room calendar (if it is more than an hour old), and you can tap Sync now at any time.</p>
          <select value={srcUnit} onChange={(e) => setSrcUnit(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-xs"><option value="">Which room does it belong to?</option>{units.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.label}</option>)}</select>
          <input value={srcName} onChange={(e) => setSrcName(e.target.value)} placeholder="Name, e.g. Booking.com" className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
          <input value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} placeholder="https://… .ics link" className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
          <button disabled={busy || !srcUnit || !srcName.trim() || !srcUrl.trim()} onClick={addSource} className="px-3 py-1.5 rounded-full bg-chs-charcoal text-white text-[11px] font-semibold disabled:opacity-50">Link calendar</button>
          {sources.filter((s) => s.active).map((s) => (
            <div key={s.id} className="border-t border-gray-100 pt-1">
              <div className="flex justify-between items-center">
                <p className="text-[11px] text-chs-charcoal">{s.name} → {s.room} <span className="text-gray-400">({s.domain})</span></p>
                <span className="flex gap-2">
                  <button disabled={busy} onClick={() => syncNow(s.id)} className="text-[10px] px-2 py-0.5 rounded-full bg-green-600 text-white">Sync now</button>
                  <button disabled={busy} onClick={async () => { if (!window.confirm("Stop syncing this calendar? Blocks already added stay until you release them.")) return; await supabase.rpc("stop_calendar_source", { p_source_id: s.id }); load(); }} className="text-[10px] underline text-red-600">Stop</button>
                </span>
              </div>
              <p className="text-[10px] text-gray-400">{s.last_synced_at ? `Last synced ${formatDateTime(s.last_synced_at)} · ${s.last_status}` : "Never synced"}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {msg && <p className="text-[11px] text-green-700">{msg}</p>}
      {err && <p className="text-[11px] text-red-600">{err}</p>}
      <p className="text-[11px] font-bold text-chs-charcoal">📥 Import from a spreadsheet</p>
      {renderImport()}
      <p className="text-[11px] font-bold text-chs-charcoal pt-2">🔄 Calendar sync</p>
      {renderSync()}
    </div>
  );
}
