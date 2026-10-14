"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime, formatCalendarDate } from "@/lib/format";
import HostBookingDecision from "@/components/HostBookingDecision";
import HostBookingServices, { SERVICE_STATUS } from "@/components/HostBookingServices";
import HostPayoutStatus from "@/components/HostPayoutStatus";
import HostBookingControls from "@/components/HostBookingControls";
import { HostShortletCheckInOut } from "@/components/ShortletCheckInOut";
import ShortletMessageThread from "@/components/ShortletMessageThread";
import ShortletRating from "@/components/ShortletRating";
import EventQuoteHost from "@/components/EventQuoteHost";
import EventDocuments from "@/components/EventDocuments";
import SeatingPicker from "@/components/SeatingPicker";
import EventOperations from "@/components/EventOperations";
import RaiseDisputeForm from "@/components/RaiseDisputeForm";
import HostClaimsPanel from "@/components/HostClaimsPanel";
import type { Claim } from "@/components/ClaimTypes";
import BookingSessions from "@/components/BookingSessions";

// The host's working screen. One read (get_host_console) feeds every tab, and the tabs follow the host's
// duties from the first request to the money:
//   Requests -> Awaiting payment -> Paid & deposits -> Changes -> Services -> Stays -> Events -> History
// The same account can run shortlets, hotels or lodges and event centres; the category filter narrows every
// tab to one kind of property. Notifications open the right tab (/host?tab=...).

interface Quote { status: string; total: number; paid: number; milestones: number; milestones_paid: number }
interface HB {
  id: string; ref: string; property_id: string; property_title: string; cat: string; my_role: string; status: string; payment_status: string | null;
  check_in: string; check_out: string; guests: number | null; guest_name: string; guest_id: string; guest_verified: boolean;
  total_price: number; host_commission: number | null; net: number; deposit_amount: number | null; deposit_status: string | null;
  event_type: string | null; tier: string | null; facilities_total: number | null; expires_at: string | null; created_at: string; paid_at: string | null;
  arrived_at: string | null; checked_in_at: string | null; expected_arrival_time: string | null; lane: string | null;
  wants_band: boolean | null; wants_caterer: boolean | null; wants_ushers: boolean | null; ushers: number | null; wants_security: boolean | null; security: number | null; extra: string | null;
  quote: Quote | null; services_open: number; changes_open: number; reply_pending?: string | null; reply_release_at?: string | null;
}
interface Chg {
  id: string; booking_id: string; property_title: string; cat: string; my_role: string; guest_name: string; check_in: string; old_guests: number | null; new_guests: number | null;
  services: { service: string; quantity?: number; note?: string }[]; note: string | null; status: string; host_note: string | null; over_capacity: boolean; tier: string | null; created_at: string; decided_at: string | null;
  new_check_in: string | null; new_check_out: string | null; extra_base: number; to_pay: number; topup_expires_at: string | null;
  tiers: { id: string; label: string; max_guests: number; price: number }[]; current_tier_price: number | null;
}
interface Svc { booking_id: string; service: string; label: string; quantity: number | null; status: string; provider_name: string | null; price: number | null; note: string | null; property_title: string; cat: string; my_role: string; guest_name: string; check_in: string; booking_status: string }
interface Consolidated { categories: string[]; properties: { id: string; title: string; cat: string; role: string }[]; bookings: HB[]; changes: Chg[]; services: Svc[] }

const CAT_LABEL: Record<string, string> = { event: "Event centre", hotel: "Hotel & lodge", shortlet: "Shortlet", other: "Other hire" };
const CAT_ICON: Record<string, string> = { event: "🎉", hotel: "🏨", shortlet: "🏠", other: "📦" };
const todayLagos = () => new Date(Date.now() + 3600000).toISOString().slice(0, 10);

type TabKey = "overview" | "requests" | "payment" | "paid" | "changes" | "refunds" | "services" | "stays" | "events" | "history" | "listings" | "work";

function timeLeft(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expiring now";
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m} min left`;
}

function ServiceChips({ b, svcs }: { b: HB; svcs: Svc[] }) {
  const mine = svcs.filter((s) => s.booking_id === b.id);
  if (mine.length === 0) {
    const flags: string[] = [];
    if (b.wants_ushers) flags.push(`🙋 ushers${b.ushers ? ` (${b.ushers})` : ""}`);
    if (b.wants_caterer) flags.push("🍽️ caterer");
    if (b.wants_band) flags.push("🎵 live band");
    if (b.wants_security) flags.push(`🛡️ security${b.security ? ` (${b.security})` : ""}`);
    if (b.extra) flags.push(`“${b.extra}”`);
    if (flags.length === 0) return null;
    return <p className="text-[10px] text-gray-600 mt-1">Asked for: {flags.join(" · ")}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {mine.map((s) => {
        const st = SERVICE_STATUS[s.status] || SERVICE_STATUS.requested;
        return <span key={s.service} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${st.cls}`}>{s.label}{s.quantity ? ` ×${s.quantity}` : ""}: {st.text}</span>;
      })}
    </div>
  );
}

function BookingCard({ b, svcs, session, mode, onChanged }: { b: HB; svcs: Svc[]; session: Session; mode: TabKey; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputed, setDisputed] = useState(false);
  const lead = b.my_role === "owner" || b.my_role === "manager";
  const confirmed = b.status === "confirmed";
  const left = timeLeft(b.expires_at);
  const unpaidFlow = b.payment_status !== "held_escrow";
  const statusText: Record<string, string> = {
    pending_host_review: "Waiting for your answer", awaiting_payment: "Waiting for guest to pay", confirmed: b.payment_status === "released" ? "Paid out" : "Paid · held by CHS",
    cancelled: "Cancelled", declined: "Declined", expired: "Expired",
  };
  return (
    <div id={`bk-${b.id}`} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="text-sm font-semibold text-chs-charcoal">{b.property_title}</p>
          <p className="text-[10px] text-gray-400">{CAT_ICON[b.cat]} {CAT_LABEL[b.cat]} · Ref {b.ref}</p>
        </div>
        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">{statusText[b.status] || b.status}</span>
      </div>
      <p className="text-xs text-chs-charcoal mt-1.5">
        {b.guest_name}{b.guest_verified && <span className="ml-1.5 text-[10px] font-semibold text-green-700">✓ identity verified by CHS</span>}
      </p>
      <p className="text-[11px] text-gray-500">
        {b.cat === "event" ? `📅 ${formatCalendarDate(b.check_in)}` : `${formatCalendarDate(b.check_in)} → ${formatCalendarDate(b.check_out)}`}
        {b.guests ? ` · ${b.guests} guests` : ""}{b.event_type ? ` · ${b.event_type}` : ""}{b.tier ? ` · ${b.tier}` : ""}
        {b.expected_arrival_time ? ` · arriving about ${b.expected_arrival_time}` : ""}
      </p>
      {b.cat === "event" && <BookingSessions bookingId={b.id} />}
      {b.lane && b.lane !== "standard" && <p className={`text-[10px] font-bold mt-1 ${b.lane === "express" ? "text-chs-red" : "text-amber-700"}`}>{b.lane === "express" ? "⚡ EXPRESS: guest arrives today" : "🕒 Guest arrives soon"}</p>}
      <p className="text-[11px] text-gray-600 mt-1">
        {formatNaira(b.total_price)}{b.facilities_total ? ` (facilities ${formatNaira(b.facilities_total)})` : ""}
        {b.host_commission != null && <> · CHS commission {formatNaira(b.host_commission)} · you receive {formatNaira(b.net)}</>}
      </p>
      {(b.deposit_amount ?? 0) > 0 && <p className="text-[10px] text-gray-500">🔒 Refundable security deposit {formatNaira(b.deposit_amount!)} · {b.deposit_status}</p>}
      {b.paid_at && <p className="text-[10px] text-green-700">💰 Paid {formatDateTime(b.paid_at)}</p>}
      {b.quote && (
        <p className="text-[10px] text-gray-600">📄 Quotation {b.quote.status}: {formatNaira(b.quote.total)} · received {formatNaira(b.quote.paid)} ({b.quote.milestones_paid}/{b.quote.milestones} instalments)</p>
      )}
      <ServiceChips b={b} svcs={svcs} />
      {(b.services_open > 0 || b.changes_open > 0) && (
        <p className="text-[10px] font-bold text-chs-red mt-1">
          {b.services_open > 0 && `${b.services_open} service request${b.services_open > 1 ? "s" : ""} to answer`}{b.services_open > 0 && b.changes_open > 0 ? " · " : ""}{b.changes_open > 0 && `${b.changes_open} change${b.changes_open > 1 ? "s" : ""} to answer`}
        </p>
      )}

      {b.status === "pending_host_review" && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          {left && !b.reply_pending && <p className="text-[10px] font-semibold text-amber-700 mb-1">⏳ {left} to answer</p>}
          <p className="text-[10px] text-gray-500 mb-1">
            {unpaidFlow ? "Confirm that the dates are free. The guest has not paid yet; they pay once you confirm." : "The guest has already paid; the money is held in escrow."}
          </p>
          {b.reply_pending
            ? <p className="text-[11px] bg-blue-50 text-blue-900 rounded-lg p-2">📨 You {b.reply_pending === "confirmed" ? "accepted" : "declined"} this request. CHS is confirming your answer to the guest. Nothing more is needed from you.</p>
            : lead ? <HostBookingDecision bookingId={b.id} unpaid={unpaidFlow} onDecided={onChanged} /> : <p className="text-[10px] text-gray-400">Only the host or a manager can answer requests.</p>}
        </div>
      )}
      {b.status === "awaiting_payment" && left && <p className="text-[10px] font-semibold text-amber-700 mt-2">⏳ The guest has {left} to pay, or the dates are released.</p>}

      {mode === "stays" && confirmed && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <p className="text-[10px] text-gray-600 mb-1">{b.checked_in_at ? `✓ Checked in ${formatDateTime(b.checked_in_at)}` : b.arrived_at ? `📍 Guest tapped “I've arrived” ${formatDateTime(b.arrived_at)}` : "Not arrived yet"}</p>
          <HostShortletCheckInOut bookingId={b.id} propertyTitle={b.property_title} />
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} className="mt-2 text-[11px] font-semibold text-chs-charcoal underline">{open ? "Hide details" : "Details, services, messages & more"}</button>
      {open && (
        <div className="mt-2 space-y-3 border-t border-gray-100 pt-2">
          {b.status !== "cancelled" && b.status !== "declined" && b.status !== "expired" && (
            <div>
              <p className="text-[11px] font-bold text-chs-charcoal mb-1">Services this guest asked for</p>
              <HostBookingServices bookingId={b.id} canAnswer={lead} onChanged={onChanged} />
            </div>
          )}
          {confirmed && <HostPayoutStatus bookingId={b.id} />}
          {b.cat === "event" && <SeatingPicker bookingId={b.id} editable={false} />}
          {b.cat === "event" && <EventDocuments bookingId={b.id} canAdd={false} />}
          {confirmed && b.cat === "event" && <EventQuoteHost bookingId={b.id} canSend={lead} />}
          {confirmed && lead && <HostBookingControls bookingId={b.id} checkIn={b.check_in} onChanged={onChanged} />}
          {confirmed && mode !== "stays" && <HostShortletCheckInOut bookingId={b.id} propertyTitle={b.property_title} />}
          <ShortletMessageThread bookingId={b.id} viewerRole="host" guestName={b.guest_name} />
          {confirmed && <ShortletRating bookingId={b.id} label="Rate this guest" />}
          {disputed ? (
            <p className="text-[10px] text-green-700 font-semibold">✓ Your report has been submitted. CHS will review it.</p>
          ) : disputing ? (
            <div className="bg-gray-50 rounded-lg p-2">
              <RaiseDisputeForm session={session} shortletBookingId={b.id} againstUserId={b.guest_id} onSuccess={() => { setDisputed(true); setDisputing(false); }} onCancel={() => setDisputing(false)} />
            </div>
          ) : (
            <button onClick={() => setDisputing(true)} className="text-[10px] text-chs-red underline">⚠️ Report an issue with this guest</button>
          )}
        </div>
      )}
    </div>
  );
}

function ChangeCard({ c, onChanged }: { c: Chg; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [tierId, setTierId] = useState("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const lead = c.my_role === "owner" || c.my_role === "manager";
  const picked = c.tiers.find((t) => t.id === tierId);
  const tierDiff = picked ? Math.max(picked.price - (c.current_tier_price || 0), 0) : 0;
  const extraNum = extra ? Number(extra) : 0;
  const total = tierDiff + extraNum;
  async function decide(d: "approved" | "declined") {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("host_decide_change", {
      p_request: c.id, p_decision: d, p_note: note.trim() || null,
      p_tier_id: d === "approved" && tierId ? tierId : null, p_extra_amount: d === "approved" && extra !== "" ? extraNum : null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const res = data as { status?: string; guest_pays?: number };
    if (d === "declined") setAfter("Declined. The guest has been told.");
    else if (res?.status === "awaiting_topup") setAfter(`Approved. The guest must now pay ${formatNaira(res.guest_pays || 0)} through CHS before the change takes effect; until they do, the booking stays as it was.`);
    else setAfter("Approved and applied. The guest has been told.");
    onChanged();
  }
  const statusCls = c.status === "pending" ? "bg-amber-100 text-amber-800" : c.status === "approved" ? "bg-green-100 text-green-800" : c.status === "awaiting_topup" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600";
  const statusText = c.status === "awaiting_topup" ? "waiting for guest to pay" : c.status;
  return (
    <div className={`bg-white rounded-xl border p-3 mb-2 ${c.status === "pending" ? "border-chs-red" : "border-gray-200 opacity-90"}`}>
      <div className="flex justify-between gap-2">
        <p className="text-sm font-semibold text-chs-charcoal">{c.property_title}</p>
        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full whitespace-nowrap ${statusCls}`}>{statusText}</span>
      </div>
      <p className="text-[11px] text-gray-500">{c.guest_name} · booked for {formatCalendarDate(c.check_in)} · asked {formatDateTime(c.created_at)}</p>
      {c.new_check_in && <p className="text-xs text-chs-charcoal mt-1">📅 Move the date: {formatCalendarDate(c.check_in)} → <b>{formatCalendarDate(c.new_check_in)}</b>{c.new_check_out && c.new_check_out !== c.new_check_in ? ` (to ${formatCalendarDate(c.new_check_out)})` : ""}</p>}
      {c.new_guests != null && (
        <p className="text-xs text-chs-charcoal mt-1">👥 Guests: {c.old_guests ?? "?"} → <b>{c.new_guests}</b>{c.tier ? ` (booked tier: ${c.tier})` : ""}</p>
      )}
      {c.over_capacity && <p className="text-[11px] font-semibold text-chs-red mt-0.5">⚠️ This is more than the booked hall tier allows. Choose a bigger tier below, or add an extra amount.</p>}
      {c.services.length > 0 && <p className="text-[11px] text-chs-charcoal mt-0.5">➕ Also asks for: {c.services.map((s) => `${s.service}${s.quantity ? ` ×${s.quantity}` : ""}`).join(", ")}</p>}
      {c.note && <p className="text-[11px] italic text-gray-600 mt-0.5">“{c.note}”</p>}
      {c.status === "awaiting_topup" && <p className="text-[11px] text-blue-800 mt-1">💰 Guest to pay {formatNaira(c.to_pay)} (your extra {formatNaira(c.extra_base)} plus CHS fee){c.topup_expires_at ? ` by ${formatDateTime(c.topup_expires_at)}` : ""}. The change applies once paid.</p>}
      {c.status !== "pending" && c.host_note && <p className="text-[10px] text-gray-500 mt-1">Your note: “{c.host_note}”</p>}
      {c.status === "pending" && lead && !after && (
        <div className="mt-2 space-y-1.5 bg-gray-50 rounded-lg p-2">
          {c.tiers.length > 0 && c.new_guests != null && (
            <select value={tierId} onChange={(e) => setTierId(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1 text-[11px] bg-white">
              <option value="">Keep the booked hall tier</option>
              {c.tiers.filter((t) => t.max_guests >= (c.new_guests || 0)).map((t) => <option key={t.id} value={t.id}>{t.label} · {formatNaira(t.price)}</option>)}
            </select>
          )}
          <input value={extra} onChange={(e) => setExtra(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Other extra amount in naira (0 if none)" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
          {total > 0 && <p className="text-[10px] text-chs-charcoal">The guest will pay <b>{formatNaira(total)}</b> plus CHS&apos;s fee through their CHS wallet. It joins their booking payment in escrow and reaches you after the event, net of CHS commission.</p>}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the guest (needed if you decline)" className="w-full border border-gray-300 rounded px-2 py-1 text-[11px]" />
          {err && <p className="text-[10px] text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => decide("approved")} className="flex-1 py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50">Approve change</button>
            <button disabled={busy} onClick={() => decide("declined")} className="flex-1 py-1.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold disabled:opacity-50">Decline</button>
          </div>
        </div>
      )}
      {after && <p className="text-[11px] text-green-700 mt-2">{after}</p>}
    </div>
  );
}

export default function HostConsole({ session, listingsNode, workNode, overviewExtra, moneyNode }: {
  session: Session; listingsNode: React.ReactNode; workNode: React.ReactNode; overviewExtra?: React.ReactNode; moneyNode?: React.ReactNode;
}) {
  const [data, setData] = useState<Consolidated | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [cat, setCat] = useState<string>("all");
  const [today] = useState(todayLagos);

  const load = useCallback(async () => {
    await supabase.rpc("host_sync_all_services");
    const { data: d, error } = await supabase.rpc("get_host_console");
    if (error) { setErr(error.message); return; }
    setData(d as Consolidated);
    const { data: cl } = await supabase.rpc("get_host_claims");
    setClaims((cl as Claim[]) || []);
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
    const valid: TabKey[] = ["overview", "requests", "payment", "paid", "changes", "refunds", "services", "stays", "events", "history", "listings", "work"];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t && valid.includes(t)) setTab(t);
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  function go(t: TabKey) {
    setTab(t);
    try { window.history.replaceState(null, "", `/host?tab=${t}`); } catch { /* ignore */ }
  }

  const inCat = useCallback((c: string) => cat === "all" || c === cat, [cat]);
  const bookings = useMemo(() => (data?.bookings || []).filter((b) => inCat(b.cat)), [data, inCat]);
  const svcsAll = useMemo(() => (data?.services || []).filter((s) => inCat(s.cat)), [data, inCat]);
  const changes = useMemo(() => (data?.changes || []).filter((c) => inCat(c.cat)), [data, inCat]);

  const requests = bookings.filter((b) => b.status === "pending_host_review");
  const payment = bookings.filter((b) => b.status === "awaiting_payment");
  const live = bookings.filter((b) => b.status === "confirmed" && b.check_out >= today);
  const stays = live.filter((b) => b.check_in <= new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10));
  const history = bookings.filter((b) => ["cancelled", "declined", "expired"].includes(b.status) || (b.status === "confirmed" && b.check_out < today));
  const openServices = svcsAll.filter((s) => s.status === "requested");
  const eventProps = (data?.properties || []).filter((p) => p.cat === "event" && inCat(p.cat));
  const cats = data?.categories || [];

  const tabs: { key: TabKey; label: string; count?: number; hot?: boolean }[] = [
    { key: "overview", label: "Overview" },
    { key: "requests", label: "Requests", count: requests.length, hot: true },
    { key: "payment", label: "Awaiting payment", count: payment.length },
    { key: "paid", label: "Paid & deposits", count: live.length },
    { key: "changes", label: "Changes", count: changes.filter((c) => c.status === "pending").length, hot: true },
    { key: "refunds", label: "Refunds & moves", count: claims.filter((c) => c.status === "awaiting_host").length, hot: true },
    { key: "services", label: "Services", count: openServices.length, hot: true },
    { key: "stays", label: "Stays & check-in", count: stays.length },
    ...(cats.includes("event") ? [{ key: "events" as TabKey, label: "Events", count: undefined }] : []),
    { key: "history", label: "History" },
    { key: "listings", label: "My listings" },
    { key: "work", label: "Team & work" },
  ];

  function bookingList(list: HB[], mode: TabKey, empty: string) {
    if (list.length === 0) return <p className="text-xs text-gray-400 py-6 text-center">{empty}</p>;
    return list.map((b) => <BookingCard key={b.id} b={b} svcs={svcsAll} session={session} mode={mode} onChanged={load} />);
  }

  const showFilter = cats.length > 1;
  const groupedServices = Object.values(openServicesGroup(svcsAll));

  return (
    <div>
      <div className="sticky top-0 z-20 bg-[var(--zone-bg)] border-b border-gray-200">
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => go(t.key)}
              className={`whitespace-nowrap text-[11px] font-semibold px-3 py-1.5 rounded-full border ${tab === t.key ? "bg-chs-charcoal text-white border-chs-charcoal" : "bg-white text-chs-charcoal border-gray-200"}`}>
              {t.label}{t.count ? <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full ${t.hot ? "bg-chs-red text-white" : "bg-gray-200 text-gray-700"}`}>{t.count}</span> : null}
            </button>
          ))}
        </div>
        {showFilter && !["listings", "work", "overview"].includes(tab) && (
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
            {["all", ...cats].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap text-[10px] font-semibold px-2.5 py-1 rounded-full ${cat === c ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"}`}>
                {c === "all" ? "All kinds" : `${CAT_ICON[c]} ${CAT_LABEL[c]}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
        {!data && !err && <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>}

        {data && tab === "overview" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { k: "requests" as TabKey, n: requests.length, t: "Requests to answer", i: "🔔" },
                { k: "payment" as TabKey, n: payment.length, t: "Waiting for guests to pay", i: "⏳" },
                { k: "paid" as TabKey, n: live.length, t: "Paid & upcoming", i: "💰" },
                { k: "changes" as TabKey, n: changes.filter((c) => c.status === "pending").length, t: "Changes to answer", i: "✏️" },
                { k: "refunds" as TabKey, n: claims.filter((c) => c.status === "awaiting_host").length, t: "Refund / date-move requests", i: "↩️" },
                { k: "services" as TabKey, n: openServices.length, t: "Service requests", i: "🙋" },
                { k: "stays" as TabKey, n: stays.length, t: "Arrivals this week", i: "🛎️" },
              ].map((x) => (
                <button key={x.k} onClick={() => go(x.k)} className={`text-left bg-white rounded-xl border p-3 ${x.n > 0 && ["requests", "changes", "services", "refunds"].includes(x.k) ? "border-chs-red" : "border-gray-200"}`}>
                  <p className="text-2xl font-bold text-chs-charcoal">{x.n}</p>
                  <p className="text-[11px] text-gray-600">{x.i} {x.t}</p>
                </button>
              ))}
            </div>
            {requests.length > 0 && (
              <div className="bg-chs-amber-light border-2 border-chs-red rounded-xl p-3">
                <p className="text-xs font-bold text-chs-red mb-1">Answer first</p>
                {requests.slice(0, 3).map((r) => (
                  <button key={r.id} onClick={() => go("requests")} className="block w-full text-left text-[11px] text-chs-charcoal py-0.5">
                    {r.guest_name} wants {r.property_title} on {formatCalendarDate(r.check_in)} · {timeLeft(r.expires_at) || ""}
                  </button>
                ))}
              </div>
            )}
            {overviewExtra}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/host/arrivals" className="bg-white rounded-xl border border-gray-200 p-3 text-center text-xs font-bold text-chs-charcoal">🛎️ Front desk<br /><span className="font-normal text-[10px] text-gray-500">today&apos;s arrivals</span></Link>
              <Link href="/host/work" className="bg-white rounded-xl border border-gray-200 p-3 text-center text-xs font-bold text-chs-charcoal">📋 Work<br /><span className="font-normal text-[10px] text-gray-500">duties &amp; shift reports</span></Link>
            </div>
            {moneyNode}
          </div>
        )}

        {data && tab === "requests" && (
          <>
            <p className="text-[11px] text-gray-500 mb-2">New booking and event requests. Confirm that the dates are free (the guest then pays), or decline with a reason. Unanswered requests lapse, and nothing is charged.</p>
            {bookingList(requests, "requests", "No requests waiting for you.")}
          </>
        )}
        {data && tab === "payment" && (
          <>
            <p className="text-[11px] text-gray-500 mb-2">You confirmed these. The guest has a limited time to pay; if they do not, the dates are released.</p>
            {bookingList(payment, "payment", "Nobody is being waited on for payment.")}
          </>
        )}
        {data && tab === "paid" && (
          <>
            <p className="text-[11px] text-gray-500 mb-2">Paid bookings, with the security deposit, the quotation for extra services and its instalments. CHS holds the money until the guest arrives and confirms.</p>
            {bookingList(live, "paid", "No paid bookings coming up.")}
          </>
        )}
        {data && tab === "changes" && (
          <>
            <p className="text-[11px] text-gray-500 mb-2">A guest asking to move the date or change the number of guests. Approving a bigger crowd lets you pick a larger hall tier or add an extra amount: the guest then pays the difference through CHS and the change takes effect once paid.</p>
            {changes.length === 0 ? <p className="text-xs text-gray-400 py-6 text-center">No change requests.</p> : changes.map((c) => <ChangeCard key={c.id + c.status} c={c} onChanged={load} />)}
          </>
        )}
        {data && tab === "refunds" && <HostClaimsPanel claims={claims} onChanged={load} />}
        {data && tab === "services" && (
          <>
            <p className="text-[11px] text-gray-500 mb-2">Ushers, caterer, live band, security, decoration and anything else guests ask for. For each one, say whether you supply it, the guest arranges it, or you cannot. The guest sees your answer on their booking.</p>
            {groupedServices.length === 0 ? <p className="text-xs text-gray-400 py-6 text-center">No service requests on live bookings.</p> : groupedServices.map((g) => (
              <div key={g.booking_id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{g.property_title}</p>
                <p className="text-[11px] text-gray-500 mb-2">{g.guest_name} · {formatCalendarDate(g.check_in)}</p>
                <HostBookingServices bookingId={g.booking_id} canAnswer={g.my_role === "owner" || g.my_role === "manager"} onChanged={load} />
              </div>
            ))}
          </>
        )}
        {data && tab === "stays" && (
          <>
            <p className="text-[11px] text-gray-500 mb-2">Guests arriving in the next 7 days or already in. Check them in on the day; the full front desk is on the Front desk page.</p>
            <Link href="/host/arrivals" className="block bg-white rounded-xl border border-gray-200 p-3 text-xs font-bold text-chs-charcoal text-center mb-2">🛎️ Open the Front desk →</Link>
            {bookingList(stays, "stays", "No arrivals in the next 7 days.")}
          </>
        )}
        {data && tab === "events" && (
          <>
            <p className="text-[11px] text-gray-500 mb-2">Event day control: vendors, the run sheet and quotations for each event centre.</p>
            {eventProps.length === 0 ? <p className="text-xs text-gray-400 py-6 text-center">No event centres.</p> : eventProps.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{p.title}</p>
                <EventOperations propertyId={p.id} />
              </div>
            ))}
          </>
        )}
        {data && tab === "history" && bookingList(history, "history", "Nothing here yet.")}
        {tab === "listings" && listingsNode}
        {tab === "work" && workNode}
      </div>
    </div>
  );
}

function openServicesGroup(list: Svc[]): Record<string, Svc> {
  const g: Record<string, Svc> = {};
  for (const s of list) {
    if (s.booking_status === "cancelled") continue;
    if (!g[s.booking_id]) g[s.booking_id] = s;
  }
  return g;
}
