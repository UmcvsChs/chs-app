"use client";

import { embeddedOne } from "@/lib/embedded";
import NotificationBell from "@/components/NotificationBell";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { GuestShortletConfirmation } from "@/components/ShortletCheckInOut";
import { unitFloor, floorName } from "@/lib/roomFloor";
import ShortletMessageThread from "@/components/ShortletMessageThread";
import BookingStageCard from "@/components/BookingStageCard";
import GuestArrivalPass from "@/components/GuestArrivalPass";
import GuestRoomMenu from "@/components/GuestRoomMenu";
import GuestEventQuote from "@/components/GuestEventQuote";
import EventDocuments from "@/components/EventDocuments";
import GuestBookingExtras from "@/components/GuestBookingExtras";
import GuestDisruptionClaim from "@/components/GuestDisruptionClaim";
import SplitPayment from "@/components/SplitPayment";
import BookingSessions from "@/components/BookingSessions";

interface Booking {
  id: string;
  check_in: string;
  check_out: string;
  time_slots?: boolean | null;
  adults?: number | null;
  children?: number | null;
  room_no?: number | null;
  room_count?: number | null;
  room_group?: string | null;
  total_price: number;
  status: string;
  payment_status: string | null;
  hold_expires_at: string | null;
  booking_lane: string | null;
  expected_arrival_time: string | null;
  guest_commission_amount: number | null;
  security_deposit_amount: number | null;
  unit_id: string | null;
  room_type_id: string | null;
  properties: { title: string }[] | null;
}

// Genuinely didn't exist before — there was no page anywhere for a
// real guest to see their own shortlet bookings or confirm a host's
// condition report. Open to any logged-in user, since booking a
// shortlet was never restricted to a single role.
export default function BookingsPanel({ embedded = false, filter = "all" }: { embedded?: boolean; filter?: "all" | "active" | "past" }) {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  // Room number and type, looked up separately (small public tables).
  const [roomLabel, setRoomLabel] = useState<Record<string, string>>({});
  const [typeName, setTypeName] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // A notification can open one booking (/my-bookings?b=<id>): scroll to it and open its services panel.
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("b");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (b) setFocusId(b);
  }, []);
  useEffect(() => {
    if (!focusId || loading) return;
    document.getElementById(`booking-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusId, loading]);

  async function loadBookings() {
    if (!session) return;
    const query = () => supabase
      .from("shortlet_bookings")
      .select("id, check_in, check_out, time_slots, adults, children, room_no, room_count, room_group, total_price, status, payment_status, hold_expires_at, booking_lane, expected_arrival_time, guest_commission_amount, security_deposit_amount, unit_id, room_type_id, properties(title)")
      .eq("guest_id", session.user.id)
      .order("check_in", { ascending: false });
    let { data, error } = await query();
    if (error) {
      // A failed read must never look like "no bookings": try once more, and if it still fails keep what is on screen and say so.
      await new Promise((r) => setTimeout(r, 1200));
      ({ data, error } = await query());
    }
    if (error) { setLoadError(true); setLoading(false); return; }
    setLoadError(false);
    // Whatever needs the guest's attention comes first (a host approval waiting to be paid), then requests still with the
    // host, then confirmed stays, then the rest; inside each group the latest dates come first.
    const rank = (st: string) => (st === "awaiting_payment" ? 0 : st === "pending_host_review" || st === "awaiting_admin_relay" ? 1 : st === "confirmed" ? 2 : 3);
    const list = ((data as unknown as Booking[]) || []).slice().sort((x, y) => rank(x.status) - rank(y.status) || (x.status === "awaiting_payment" && y.status === "awaiting_payment" ? String(x.hold_expires_at || "").localeCompare(String(y.hold_expires_at || "")) : 0));
    setBookings(list);
    const unitIds = list.map((b) => b.unit_id).filter(Boolean) as string[];
    const typeIds = list.map((b) => b.room_type_id).filter(Boolean) as string[];
    if (unitIds.length > 0) {
      const { data: units } = await supabase.from("property_units").select("id, label, floor_no").in("id", unitIds);
      setRoomLabel(Object.fromEntries((units || []).map((u) => { const f = unitFloor(u.label, u.floor_no); return [u.id, `${u.label}${f !== null ? ` · ${floorName(f)}` : ""}`]; })));
    }
    if (typeIds.length > 0) {
      const { data: types } = await supabase.from("room_types").select("id, name").in("id", typeIds);
      setTypeName(Object.fromEntries((types || []).map((t) => [t.id, t.name])));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBookings();
  }, [authLoading, session]);

  const isOver = (b: Booking) => ["cancelled", "declined", "expired"].includes(b.status) || b.check_out < new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const shown = bookings.filter((b) => filter === "all" ? true : filter === "active" ? !isOver(b) : isOver(b));

  if (authLoading || loading) {
    return <div className={`${embedded ? "py-16" : "min-h-screen"} flex items-center justify-center text-sm text-gray-400`}>Loading...</div>;
  }

  return (
    <div className={embedded ? "px-4 py-4" : "min-h-screen bg-[var(--zone-bg)] px-4 py-8"}>
      <div className="max-w-md mx-auto">
        {!embedded && (<>
        <button onClick={() => router.back()} className="text-xs text-gray-400 mb-4 inline-block">← Back</button>
        <div className="flex items-center gap-2"><h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">🏠 My Shortlet Bookings</h1><NotificationBell /></div>
        <Link href="/tenant" className="text-xs text-chs-red font-semibold underline mb-4 inline-block">
          Looking for a long-term rental instead? See My Rentals →
        </Link>

        </>)}
        {loadError && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            We could not load your bookings just now. Your bookings are safe.{" "}
            <button onClick={() => { setLoading(true); loadBookings(); }} className="font-semibold underline">Try again</button>
          </div>
        )}
        {shown.length === 0 && !loadError ? (
          <p className="text-sm text-gray-400 text-center py-10">No shortlet bookings yet.</p>
        ) : (
          <div className="space-y-3">
            {shown.map((b) => (
              <div key={b.id} id={`booking-${b.id}`} className={`bg-white rounded-xl border p-4 ${focusId === b.id ? "border-chs-red ring-2 ring-chs-red/30" : "border-gray-200"}`}>
                <p className="text-sm font-bold text-chs-charcoal">{embeddedOne(b.properties)?.title || "Property"}</p>
                {b.time_slots ? <BookingSessions bookingId={b.id} compact /> : <p className="text-xs text-gray-500">{b.check_in} → {b.check_out}</p>}
                <p className="text-xs text-gray-500">{formatNaira(b.total_price)} stay</p>
                {(b.room_count || 0) > 1 && <p className="text-[11px] font-semibold text-chs-charcoal">🛏️ Room {b.room_no} of {b.room_count}, booked together</p>}
                {b.adults ? <p className="text-[11px] text-gray-500">👥 {b.adults} adult{b.adults > 1 ? "s" : ""}{b.children ? `, ${b.children} child${b.children > 1 ? "ren" : ""}` : ""}</p> : null}
                <BookingStageCard booking={b} onChanged={loadBookings} />
                {/* The room is only named once the host has confirmed: until
                    then it is a request, and the host may still move you. */}
                {b.status === "confirmed" && b.unit_id && roomLabel[b.unit_id] && roomLabel[b.unit_id] !== "Whole property" && (
                  <p className="text-xs font-semibold text-chs-charcoal mt-0.5">🛏️ Your room: {roomLabel[b.unit_id]}{b.room_type_id && typeName[b.room_type_id] ? ` (${typeName[b.room_type_id]})` : ""}</p>
                )}
                {["awaiting_admin_relay", "pending_host_review", "awaiting_payment"].includes(b.status) && b.room_type_id && typeName[b.room_type_id] && (
                  <p className="text-[11px] text-gray-500 mt-0.5">Requested: {typeName[b.room_type_id]} room — a specific room is named once the host confirms.</p>
                )}
                {b.status === "confirmed" && <GuestArrivalPass bookingId={b.id} />}
                {b.status === "confirmed" && <GuestRoomMenu bookingId={b.id} />}
                {b.status !== "cancelled" && <GuestEventQuote bookingId={b.id} />}
                {b.status !== "cancelled" && <EventDocuments bookingId={b.id} canAdd />}
                <GuestBookingExtras bookingId={b.id} status={b.status} checkIn={b.check_in} startOpen={focusId === b.id} />
                <SplitPayment bookingId={b.id} status={b.status} onChanged={loadBookings} />
                {b.status === "confirmed" && b.payment_status === "held_escrow" && <GuestDisruptionClaim bookingId={b.id} onDone={loadBookings} />}
                <GuestShortletConfirmation bookingId={b.id} />
                <ShortletMessageThread bookingId={b.id} viewerRole="guest" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
