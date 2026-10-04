"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import { addDays, parseISO, todayISO } from "@/lib/availability";
import { parseRoomLabels } from "@/lib/roomLabels";
import { formatNaira } from "@/lib/format";

// The host's own view of their rooms and calendar — the hotel "tape chart":
// every room down the side, the next 14 days across the top.
//
// This is what keeps CHS honest with guests. Guests book on what the calendar
// shows, so the host's job is to keep it true: record the guest who walked in
// this morning, block the room that is being repaired, and tap "My calendar is
// accurate" each day. The daily reminder and the admin stale-calendar alert
// both rest on that one tap.

interface RoomType { id: string; name: string; max_guests: number | null; price_per_night: number | null }
interface Unit { id: string; label: string; room_type_id: string | null }
interface Entry {
  id: string; unit_id: string; start: string; end: string;
  state: "held" | "confirmed" | "blocked" | "walk_in";
  label: string | null; note: string | null; booking_id: string | null; expires_at: string | null;
}
interface HostCal {
  property: { id: string; title: string; calendar_confirmed_at: string | null; purpose: string };
  from: string; to: string;
  room_types: RoomType[]; units: Unit[]; entries: Entry[];
}

const WINDOW = 14;
const cleanMsg = (m: string) => m.replace(/^dates_unavailable:\s*/, "");
const pretty = (iso: string) => parseISO(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

function freshness(stamp: string | null): { text: string; tone: "ok" | "warn" | "bad" } {
  if (!stamp) return { text: "Never confirmed — guests can't tell if this is up to date", tone: "bad" };
  const hrs = (Date.now() - new Date(stamp).getTime()) / 3600000;
  if (hrs < 24) return { text: hrs < 1 ? "Confirmed just now" : `Confirmed ${Math.floor(hrs)}h ago`, tone: "ok" };
  const days = Math.floor(hrs / 24);
  return { text: `Last confirmed ${days} day${days !== 1 ? "s" : ""} ago`, tone: days >= 3 ? "bad" : "warn" };
}

const CELL: Record<string, string> = {
  free: "bg-green-50 border-green-200",
  held: "bg-amber-100 border-dashed border-amber-400",
  confirmed: "bg-red-200 border-red-300",
  blocked: "bg-gray-300 border-gray-400",
  walk_in: "bg-purple-200 border-purple-300",
};

type Sheet =
  | { kind: "free"; unit: Unit; date: string }
  | { kind: "entry"; entry: Entry; unit: Unit }
  | null;

export default function HostCalendarPage() {
  const params = useParams();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const propertyId = params.id as string;

  const [offset, setOffset] = useState(0);
  const [cal, setCal] = useState<HostCal | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  // block / walk-in form
  const [entryKind, setEntryKind] = useState<"blocked" | "walk_in">("walk_in");
  const [entryEnd, setEntryEnd] = useState("");
  const [entryLabel, setEntryLabel] = useState("");
  const [entryNote, setEntryNote] = useState("");

  // fully-booked form
  const [fullStart, setFullStart] = useState("");
  const [fullEnd, setFullEnd] = useState("");
  const [fullNote, setFullNote] = useState("");

  // rooms forms
  const [typeName, setTypeName] = useState("");
  const [typeGuests, setTypeGuests] = useState("");
  const [typePrice, setTypePrice] = useState("");
  const [addTypeId, setAddTypeId] = useState("");
  const [addText, setAddText] = useState("");
  const [renaming, setRenaming] = useState<Record<string, string>>({});

  const today = useMemo(() => todayISO(), []);
  const from = useMemo(() => addDays(today, offset), [today, offset]);
  const dates = useMemo(() => Array.from({ length: WINDOW }, (_, i) => addDays(from, i)), [from]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_host_calendar", { p_property_id: propertyId, p_from: from, p_days: WINDOW });
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    setCal(data as HostCal);
    setLoadError(null);
    setLoading(false);
  }, [propertyId, from]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // load() only sets state after its network call returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [authLoading, session, router, load]);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, success?: string): Promise<boolean> {
    setBusy(true);
    setNotice(null);
    const { error } = await action();
    setBusy(false);
    if (error) { setNotice({ tone: "err", text: cleanMsg(error.message) }); return false; }
    if (success) setNotice({ tone: "ok", text: success });
    await load();
    return true;
  }

  const typeById = useMemo(() => Object.fromEntries((cal?.room_types || []).map((t) => [t.id, t])), [cal]);

  function entryAt(unitId: string, iso: string): Entry | undefined {
    return cal?.entries.find((e) => e.unit_id === unitId && e.start <= iso && e.end > iso);
  }

  function openFree(unit: Unit, date: string) {
    setEntryKind("walk_in");
    setEntryEnd(addDays(date, 1));
    setEntryLabel("");
    setEntryNote("");
    setNotice(null);
    setSheet({ kind: "free", unit, date });
  }

  async function saveEntry() {
    if (sheet?.kind !== "free") return;
    const ok = await run(
      () => supabase.rpc("host_block_dates", {
        p_unit_id: sheet.unit.id, p_start: sheet.date, p_end: entryEnd, p_kind: entryKind,
        p_label: entryKind === "walk_in" ? entryLabel : null, p_note: entryNote || null,
      }),
      entryKind === "walk_in" ? `Walk-in recorded for room ${sheet.unit.label}.` : `Room ${sheet.unit.label} blocked.`
    );
    if (ok) setSheet(null);
  }

  async function removeEntry(e: Entry) {
    const ok = await run(() => supabase.rpc("host_remove_block", { p_calendar_id: e.id }), "Removed — the room is open again.");
    if (ok) setSheet(null);
  }

  async function confirmCalendar() {
    await run(() => supabase.rpc("host_confirm_calendar", { p_property_id: propertyId }), "Thank you — your calendar is marked accurate as of now.");
  }

  async function blockAll() {
    if (!fullStart || !fullEnd) { setNotice({ tone: "err", text: "Choose the first and last dates." }); return; }
    setBusy(true);
    setNotice(null);
    const { data, error } = await supabase.rpc("host_block_all_rooms", { p_property_id: propertyId, p_start: fullStart, p_end: fullEnd, p_note: fullNote || null });
    setBusy(false);
    if (error) { setNotice({ tone: "err", text: cleanMsg(error.message) }); return; }
    const skipped = (data?.skipped || []) as { room: string }[];
    setNotice({
      tone: skipped.length ? "err" : "ok",
      text: `${data?.blocked ?? 0} room(s) marked unavailable.` + (skipped.length ? ` Skipped (already booked, requested or blocked): ${skipped.map((s) => s.room).join(", ")}.` : ""),
    });
    await load();
  }

  async function saveType() {
    if (!typeName.trim()) { setNotice({ tone: "err", text: "Give the room type a name, e.g. Executive." }); return; }
    const ok = await run(() => supabase.rpc("host_save_room_type", {
      p_property_id: propertyId, p_name: typeName, p_max_guests: typeGuests ? parseInt(typeGuests, 10) : null, p_price: typePrice ? parseFloat(typePrice) : null,
    }), `Room type "${typeName.trim()}" saved.`);
    if (ok) { setTypeName(""); setTypeGuests(""); setTypePrice(""); }
  }

  const parsed = useMemo(() => parseRoomLabels(addText), [addText]);
  async function addRooms() {
    if (parsed.error) { setNotice({ tone: "err", text: parsed.error }); return; }
    if (parsed.labels.length === 0) { setNotice({ tone: "err", text: "Type the room numbers first, e.g. 101-112, 201, 204." }); return; }
    const ok = await run(() => supabase.rpc("host_add_rooms", { p_property_id: propertyId, p_room_type_id: addTypeId || null, p_labels: parsed.labels }), `${parsed.labels.length} room(s) added.`);
    if (ok) setAddText("");
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading…</div>;
  }
  if (loadError || !cal) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-bold text-chs-charcoal mb-1">This calendar isn&apos;t available</p>
          <p className="text-xs text-gray-500 mb-3">{loadError ? cleanMsg(loadError) : "Something went wrong."}</p>
          <Link href="/host" className="text-xs font-semibold text-chs-red underline">← Back to my host dashboard</Link>
        </div>
      </div>
    );
  }

  const fresh = freshness(cal.property.calendar_confirmed_at);
  const freshColor = fresh.tone === "ok" ? "text-green-700" : fresh.tone === "warn" ? "text-amber-700" : "text-chs-red";
  const placeholder = cal.units.find((u) => u.label === "Whole property");
  const waiting = cal.entries.filter((e) => e.state === "held");

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-host pb-16">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/host" className="text-xs text-white/70">← Back to my host dashboard</Link>
        <RoleBadge label="Host" />
        <h1 className="font-serif text-lg font-bold mt-1">Rooms &amp; Calendar</h1>
        <p className="text-xs text-white/80">{cal.property.title}</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* The one-tap daily confirmation */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs text-gray-600 mb-2">
            Guests book on what this calendar shows. Record anyone who walked in, block rooms under repair, then confirm.
          </p>
          <p className={`text-[11px] font-semibold mb-2 ${freshColor}`}>● {fresh.text}</p>
          <button onClick={confirmCalendar} disabled={busy}
            className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            ✓ My calendar is accurate
          </button>
        </div>

        {notice && (
          <p className={`text-xs rounded-lg px-3 py-2 ${notice.tone === "ok" ? "bg-green-50 text-green-700" : "bg-chs-amber-light text-chs-red"}`}>{notice.text}</p>
        )}

        {waiting.length > 0 && (
          <Link href="/host" className="block bg-chs-amber-light border-2 border-chs-red rounded-xl p-3">
            <p className="text-xs font-bold text-chs-red">🔔 {waiting.length} guest request{waiting.length !== 1 ? "s" : ""} waiting for your answer</p>
            <p className="text-[10px] text-gray-500">Unanswered requests expire after 24 hours and the guest is refunded. Tap to answer →</p>
          </Link>
        )}

        {placeholder && (
          <div className="bg-chs-amber-light rounded-xl border border-chs-amber p-3">
            <p className="text-xs font-bold text-chs-charcoal mb-0.5">Give your first room a real number</p>
            <p className="text-[11px] text-gray-600 mb-2">
              Every listing starts with a placeholder room called &quot;Whole property&quot;. Yours already holds a booking, so rename it to the real room (e.g. 104) — it keeps its booking.
            </p>
            <div className="flex gap-2">
              <input value={renaming[placeholder.id] ?? ""} onChange={(e) => setRenaming({ ...renaming, [placeholder.id]: e.target.value })}
                placeholder="e.g. 104" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <button disabled={busy || !(renaming[placeholder.id] || "").trim()}
                onClick={() => run(() => supabase.rpc("host_update_room", { p_unit_id: placeholder.id, p_label: renaming[placeholder.id] }), "Room renamed.")}
                className="px-4 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-40">Rename</button>
            </div>
          </div>
        )}

        {/* Tape chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setOffset((o) => Math.max(0, o - WINDOW))} disabled={offset === 0} className="text-xs font-semibold text-chs-charcoal disabled:opacity-30">‹ Earlier</button>
            <p className="text-xs font-bold text-chs-charcoal">{pretty(dates[0])} – {pretty(dates[WINDOW - 1])}</p>
            <button onClick={() => setOffset((o) => o + WINDOW)} className="text-xs font-semibold text-chs-charcoal">Later ›</button>
          </div>

          {cal.units.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No rooms yet — add them below.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid gap-px" style={{ gridTemplateColumns: `76px repeat(${WINDOW}, 38px)`, minWidth: 76 + WINDOW * 39 }}>
                <div />
                {dates.map((d) => (
                  <div key={d} className={`text-center text-[9px] font-semibold leading-tight pb-1 ${d === today ? "text-chs-red" : "text-gray-400"}`}>
                    {parseISO(d).toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2)}<br />{parseISO(d).getDate()}
                  </div>
                ))}
                {cal.units.map((u) => (
                  <div key={u.id} className="contents">
                    <div className="pr-1 flex flex-col justify-center">
                      <span className="text-xs font-bold text-chs-charcoal truncate">{u.label}</span>
                      {u.room_type_id && typeById[u.room_type_id] && <span className="text-[9px] text-gray-400 truncate">{typeById[u.room_type_id].name}</span>}
                    </div>
                    {dates.map((d) => {
                      const e = entryAt(u.id, d);
                      const past = d < today;
                      const state = e ? e.state : "free";
                      const first = e && (d === e.start || d === dates[0]);
                      return (
                        <button key={d} disabled={past && !e}
                          onClick={() => (e ? setSheet({ kind: "entry", entry: e, unit: u }) : openFree(u, d))}
                          aria-label={`Room ${u.label}, ${pretty(d)}, ${e ? e.state : "free"}`}
                          className={`h-8 border text-[9px] font-semibold overflow-hidden text-gray-700 ${CELL[state]} ${past ? "opacity-50" : ""}`}>
                          {first ? (e!.state === "held" ? "?" : (e!.label || "").slice(0, 3)) : ""}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
            {[["free", "Free"], ["held", "Requested — answer it"], ["confirmed", "Guest booked"], ["walk_in", "Walk-in"], ["blocked", "Blocked"]].map(([k, l]) => (
              <span key={k} className="flex items-center gap-1 text-[9px] text-gray-500"><span className={`w-3 h-3 border inline-block ${CELL[k]}`} /> {l}</span>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Tap a free square to block the room or record a walk-in. Tap a coloured square for details.</p>
        </div>

        {/* Fully booked */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-bold text-chs-charcoal mb-0.5">🚫 Fully booked or closed?</p>
          <p className="text-[11px] text-gray-500 mb-2">Mark every free room unavailable for a period — for a festival, a private function or maintenance. Rooms that already have a guest are left alone.</p>
          <div className="flex gap-2 mb-2">
            <div className="flex-1"><label className="text-[10px] font-semibold text-gray-500">From</label>
              <input type="date" min={today} value={fullStart} onChange={(e) => { setFullStart(e.target.value); if (!fullEnd || fullEnd <= e.target.value) setFullEnd(addDays(e.target.value, 1)); }} className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div className="flex-1"><label className="text-[10px] font-semibold text-gray-500">Until (check-out day)</label>
              <input type="date" min={fullStart || today} value={fullEnd} onChange={(e) => setFullEnd(e.target.value)} className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm" /></div>
          </div>
          <input value={fullNote} onChange={(e) => setFullNote(e.target.value)} placeholder="Reason (only you see this), e.g. Calabar Carnival" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2" />
          <button onClick={blockAll} disabled={busy} className="w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">Mark all free rooms unavailable</button>
        </div>

        {/* Rooms */}
        <details className="bg-white rounded-xl border border-gray-200 p-3" open={cal.units.length === 0}>
          <summary className="text-xs font-bold text-chs-charcoal cursor-pointer">🛏️ My rooms &amp; room types ({cal.units.length} room{cal.units.length !== 1 ? "s" : ""})</summary>

          <div className="mt-3 space-y-4">
            <div>
              <p className="text-[11px] font-bold text-chs-charcoal mb-1">1. Room types</p>
              <p className="text-[10px] text-gray-500 mb-1.5">Group rooms the way guests think of them (Executive, Standard). Guests pick a type; CHS gives them a free room of that type. A price here overrides the listing price for that type.</p>
              {cal.room_types.length > 0 && (
                <div className="space-y-1 mb-2">
                  {cal.room_types.map((t) => (
                    <p key={t.id} className="text-[11px] text-gray-700 bg-gray-50 rounded px-2 py-1">
                      <b>{t.name}</b> · {cal.units.filter((u) => u.room_type_id === t.id).length} rooms{t.max_guests ? ` · up to ${t.max_guests} guests` : ""}{t.price_per_night ? ` · ${formatNaira(t.price_per_night)}/night` : " · listing price"}
                    </p>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="Name" className="col-span-3 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                <input value={typeGuests} onChange={(e) => setTypeGuests(e.target.value.replace(/\D/g, ""))} placeholder="Max guests" inputMode="numeric" className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                <input value={typePrice} onChange={(e) => setTypePrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="₦ / night" inputMode="decimal" className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </div>
              <button onClick={saveType} disabled={busy} className="w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">Save room type</button>
            </div>

            <div>
              <p className="text-[11px] font-bold text-chs-charcoal mb-1">2. Add rooms</p>
              <p className="text-[10px] text-gray-500 mb-1.5">Type room numbers or ranges, separated by commas — for example <b>101-112, 201, 204</b>.</p>
              <select value={addTypeId} onChange={(e) => setAddTypeId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2">
                <option value="">No room type</option>
                {cal.room_types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input value={addText} onChange={(e) => setAddText(e.target.value)} placeholder="101-112, 201, 204" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-1" />
              {addText && (
                <p className={`text-[10px] mb-2 ${parsed.error ? "text-chs-red" : "text-gray-500"}`}>
                  {parsed.error || `Will add ${parsed.labels.length} room${parsed.labels.length !== 1 ? "s" : ""}: ${parsed.labels.slice(0, 8).join(", ")}${parsed.labels.length > 8 ? ", …" : ""}`}
                </p>
              )}
              <button onClick={addRooms} disabled={busy} className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">Add rooms</button>
            </div>

            {cal.units.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-chs-charcoal mb-1">3. Your rooms</p>
                <div className="space-y-1.5">
                  {cal.units.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                      <span className="text-xs font-bold text-chs-charcoal w-16 truncate">{u.label}</span>
                      <select value={u.room_type_id || ""} disabled={busy}
                        onChange={(e) => run(() => supabase.rpc("host_update_room", { p_unit_id: u.id, p_room_type_id: e.target.value || null, p_clear_type: !e.target.value }), "Room type updated.")}
                        className="flex-1 px-2 py-1 rounded border border-gray-200 text-[11px] bg-white">
                        <option value="">No type</option>
                        {cal.room_types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <button disabled={busy} onClick={() => run(() => supabase.rpc("host_update_room", { p_unit_id: u.id, p_active: false }), `Room ${u.label} switched off.`)}
                        className="text-[10px] font-semibold text-gray-400 underline">Switch off</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* Action sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setSheet(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-md mx-auto p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {sheet.kind === "free" ? (
              <>
                <p className="text-sm font-bold text-chs-charcoal">Room {sheet.unit.label} · from {pretty(sheet.date)}</p>
                <div className="flex gap-2 my-3">
                  {([["walk_in", "Record a walk-in guest"], ["blocked", "Block this room"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setEntryKind(k)}
                      className={`flex-1 py-2 rounded-lg border text-[11px] font-semibold ${entryKind === k ? "border-chs-red bg-chs-amber-light text-chs-red" : "border-gray-200 text-gray-500"}`}>{l}</button>
                  ))}
                </div>
                <label className="text-[10px] font-semibold text-gray-500">Until (check-out day)</label>
                <input type="date" min={addDays(sheet.date, 1)} value={entryEnd} onChange={(e) => setEntryEnd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2" />
                {entryKind === "walk_in" && (
                  <input value={entryLabel} onChange={(e) => setEntryLabel(e.target.value)} placeholder="Guest's name" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2" />
                )}
                <input value={entryNote} onChange={(e) => setEntryNote(e.target.value)} placeholder={entryKind === "blocked" ? "Reason, e.g. repairs (only you see this)" : "Note (optional)"} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3" />
                {notice?.tone === "err" && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mb-2">{notice.text}</p>}
                <button onClick={saveEntry} disabled={busy} className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
                  {busy ? "Saving…" : entryKind === "walk_in" ? "Record walk-in" : "Block room"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-chs-charcoal">Room {sheet.unit.label}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {sheet.entry.state === "confirmed" && `Guest booking — ${sheet.entry.label || "guest"}`}
                  {sheet.entry.state === "held" && `Requested by ${sheet.entry.label || "a guest"} — waiting for your answer`}
                  {sheet.entry.state === "walk_in" && `Walk-in — ${sheet.entry.label}`}
                  {sheet.entry.state === "blocked" && "Blocked by you"}
                </p>
                <p className="text-xs text-gray-500">{pretty(sheet.entry.start)} → {pretty(sheet.entry.end)}</p>
                {sheet.entry.note && <p className="text-[11px] text-gray-500 italic mt-1">&quot;{sheet.entry.note}&quot;</p>}
                {sheet.entry.state === "held" && sheet.entry.expires_at && (
                  <p className="text-[11px] text-chs-red mt-1">Expires {new Date(sheet.entry.expires_at).toLocaleString()} — then the guest is refunded automatically.</p>
                )}
                <div className="mt-3 space-y-2">
                  {(sheet.entry.state === "held" || sheet.entry.state === "confirmed") && (
                    <Link href="/host" className="block text-center py-2.5 rounded-full bg-chs-charcoal text-white text-sm font-semibold">
                      {sheet.entry.state === "held" ? "Answer this request →" : "See this booking →"}
                    </Link>
                  )}
                  {(sheet.entry.state === "blocked" || sheet.entry.state === "walk_in") && (
                    <button onClick={() => removeEntry(sheet.entry)} disabled={busy} className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
                      {sheet.entry.state === "walk_in" ? "Guest has left — free this room" : "Remove block — open the room again"}
                    </button>
                  )}
                  <button onClick={() => setSheet(null)} className="w-full py-2 text-xs text-gray-400 underline">Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
