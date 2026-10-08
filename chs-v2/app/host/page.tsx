"use client";

import { embeddedOne } from "@/lib/embedded";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";
import InfoTip from "@/components/InfoTip";
import { HostShortletCheckInOut } from "@/components/ShortletCheckInOut";
import HostPayoutStatus from "@/components/HostPayoutStatus";
import HouseRulesUpload from "@/components/HouseRulesUpload";
import ShortletMessageThread from "@/components/ShortletMessageThread";
import PendingBookingRequests from "@/components/PendingBookingRequests";
import RaiseDisputeForm from "@/components/RaiseDisputeForm";
import ShortletRating from "@/components/ShortletRating";
import HostHotelTools from "@/components/HostHotelTools";
import HostBookingControls from "@/components/HostBookingControls";
import HostStaffManager from "@/components/HostStaffManager";

// Real, new dashboard completing a direct, thorough client decision:
// Host is a genuine, separate role from Owner — a real, different
// business (short, high-frequency stays vs. a long-term tenancy),
// with its own real commission rates (already correctly different)
// and now its own real, focused space, reusing the exact same,
// already-tested booking and messaging components already proven on
// the Owner dashboard rather than rebuilding them from scratch.
interface HostListing {
  id: string;
  title: string;
  hire_category: string | null;
  price_per_night: number | null;
  price: number;
  status: string;
  calendar_confirmed_at: string | null;
}

// How fresh a listing's availability calendar is — guests book on what it
// shows, so a stale one is a real risk to the host and to CHS.
function calendarFreshness(stamp: string | null): { text: string; className: string } {
  if (!stamp) return { text: "📅 Calendar never confirmed", className: "text-chs-red" };
  const hrs = (Date.now() - new Date(stamp).getTime()) / 3600000;
  if (hrs < 24) return { text: "📅 Calendar confirmed today", className: "text-green-700" };
  const days = Math.floor(hrs / 24);
  return { text: `📅 Calendar last confirmed ${days} day${days !== 1 ? "s" : ""} ago`, className: days >= 3 ? "text-chs-red" : "text-amber-700" };
}

interface HostBooking {
  id: string;
  guest_id: string;
  guest_full_name: string;
  guest_verified: boolean;
  check_in: string;
  check_out: string;
  status: string;
  total_price: number;
  host_commission_amount: number;
  wants_music_band: boolean;
  wants_caterer: boolean;
  wants_ushers: boolean;
  number_of_ushers: number | null;
  additional_event_requests: string | null;
  properties: { title: string }[] | null;
}

export default function HostDashboardPage() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [listings, setListings] = useState<HostListing[]>([]);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [confirmingCalendars, setConfirmingCalendars] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<string | null>(null);

  async function handleConfirmAllCalendars() {
    setConfirmingCalendars(true);
    setCalendarMsg(null);
    const { data, error } = await supabase.rpc("host_confirm_all_calendars");
    setConfirmingCalendars(false);
    if (error) { setCalendarMsg("Could not save that just now. Please try again."); return; }
    const now = new Date().toISOString();
    setListings((prev) => prev.map((l) => ({ ...l, calendar_confirmed_at: now })));
    setCalendarMsg(`Thank you — ${data} listing${data === 1 ? "" : "s"} marked accurate as of now.`);
  }
  const [loading, setLoading] = useState(true);
  const [disputingBookingId, setDisputingBookingId] = useState<string | null>(null);
  const [disputeSubmitted, setDisputeSubmitted] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    Promise.all([
      supabase.from("properties")
        .select("id, title, hire_category, price_per_night, price, status, calendar_confirmed_at")
        .eq("owner_id", session.user.id)
        .or("purpose.eq.shortlet,and(purpose.eq.hire,hire_category.not.is.null)"),
      supabase.from("shortlet_bookings")
        .select("id, guest_id, guest_full_name, guest_verified, check_in, check_out, status, total_price, host_commission_amount, wants_music_band, wants_caterer, wants_ushers, number_of_ushers, additional_event_requests, properties!inner(title, owner_id)")
        .eq("properties.owner_id", session.user.id)
        .in("status", ["confirmed", "active"]),
    ]).then(([listingsRes, bookingsRes]) => {
      setListings(listingsRes.data || []);
      setBookings((bookingsRes.data as unknown as HostBooking[]) || []);
      setLoading(false);
    });
  }, [authLoading, session, router]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10 zone-host">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <RoleBadge label="Host" />
        <h1 className="font-serif text-lg font-bold mt-1">My Host Dashboard</h1>
        <p className="text-xs text-white/60 mt-1">Shortlet, hotel/event, and casual hire — a real, different business from a long-term rental.</p>
        {[profile?.role, ...(profile?.secondary_roles || [])].includes("owner") && (
          <Link href="/owner" className="text-[10px] font-semibold text-white/70 underline mt-1 inline-block">
            Switch to my Owner dashboard →
          </Link>
        )}
      </div>

      <PendingBookingRequests />

      <div className="px-4 py-4 space-y-2">
        {listings.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
            <p className="text-xs font-bold text-chs-charcoal mb-0.5">📅 Keep your availability true</p>
            <p className="text-[11px] text-gray-500 mb-2">Guests book on what your calendars show. Once you&apos;ve recorded today&apos;s walk-ins, tap below — one tap covers every listing.</p>
            {calendarMsg && <p className="text-[11px] text-green-700 mb-2">{calendarMsg}</p>}
            <button onClick={handleConfirmAllCalendars} disabled={confirmingCalendars}
              className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {confirmingCalendars ? "Saving…" : "✓ All my calendars are accurate"}
            </button>
          </div>
        )}
        {listings.length > 0 && (
          <>
            <Link href="/host/arrivals" className="block bg-white rounded-xl border border-gray-200 p-3 text-sm font-bold text-chs-charcoal text-center mb-2">
              🛎️ Front Desk: today&apos;s arrivals &amp; check-in →
            </Link>
            <HostStaffManager />
          </>
        )}
        <p className="text-xs font-bold text-chs-charcoal">🏠 My Real Listings ({listings.length})</p>
        {listings.length === 0 ? (
          <p className="text-xs text-gray-400 mb-4">No real shortlet or hire listings yet.</p>
        ) : (
          listings.map((l) => (
            <div key={l.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold text-chs-charcoal">{l.title}</p>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-gray-500 bg-gray-100">{l.status}</span>
              </div>
              <p className="text-xs text-gray-500">
                {formatNaira(l.price_per_night || l.price)}{l.price_per_night ? "/night" : ""} · {l.hire_category?.replace(/_/g, " ") || "Shortlet"}
              </p>
              <p className={`text-[10px] font-semibold mt-1 ${calendarFreshness(l.calendar_confirmed_at).className}`}>{calendarFreshness(l.calendar_confirmed_at).text}</p>
              {/* House rules the guest must read and accept before requesting to book */}
              {session && <div className="mt-2"><HouseRulesUpload propertyId={l.id} session={session} /></div>}
              <HostHotelTools propertyId={l.id} />
              <Link href={`/host/calendar/${l.id}`} className="mt-2 block text-center py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold">
                Rooms &amp; calendar →
              </Link>
            </div>
          ))
        )}

        <Link href="/list-property" className="block bg-white rounded-xl border border-gray-200 p-4 text-sm font-bold text-chs-charcoal text-center">
          + List a new shortlet or hire property →<InfoTip text="A real, separate listing for short stays or casual hire — chalets, hotel rooms, event centres — priced per night or per booking, not per year like a normal rental." />
        </Link>

        {bookings.length > 0 && (
          <>
            {/* Real, critical fix per direct, serious client
                feedback: a booking request now genuinely requires the
                host's own real decision before it's confirmed — not
                an instant, unreviewable charge. */}
            {bookings.filter((b) => b.status !== "pending_host_review").length > 0 && (
              <>
                <p className="text-xs font-bold text-chs-charcoal mt-4">📋 Real Guest Bookings</p>
                {bookings.filter((b) => b.status !== "pending_host_review").map((b) => (
                  <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
                    <p className="text-xs font-semibold text-chs-charcoal">{embeddedOne(b.properties)?.title || "Property"}</p>
                    <p className="text-[10px] text-gray-400">{b.guest_full_name} · Ref REQ-{b.id.slice(0, 8)} · {b.check_in} → {b.check_out}</p>
                    {(b.wants_music_band || b.wants_caterer || b.wants_ushers || b.additional_event_requests) && (
                      <div className="bg-gray-50 rounded-lg px-2 py-1.5 mt-1.5">
                        <p className="text-[9px] font-bold text-chs-charcoal uppercase mb-0.5">🎉 Real event-day requests</p>
                        {b.wants_music_band && <p className="text-[10px] text-gray-700">🎵 Music band / live entertainment</p>}
                        {b.wants_caterer && <p className="text-[10px] text-gray-700">🍽️ Caterer</p>}
                        {b.wants_ushers && <p className="text-[10px] text-gray-700">🙋 {b.number_of_ushers || "?"} usher(s)</p>}
                        {b.additional_event_requests && <p className="text-[10px] text-gray-600 italic mt-0.5">&quot;{b.additional_event_requests}&quot;</p>}
                      </div>
                    )}
                    {b.guest_verified && <p className="text-[10px] font-semibold text-green-700">✓ Guest identity verified by CHS</p>}
                    <HostPayoutStatus bookingId={b.id} />
                    {b.status === "confirmed" && <HostBookingControls bookingId={b.id} checkIn={b.check_in} onChanged={() => router.refresh()} />}
                    <HostShortletCheckInOut bookingId={b.id} propertyTitle={embeddedOne(b.properties)?.title || "Property"} />
                    <ShortletMessageThread bookingId={b.id} viewerRole="host" guestName={b.guest_full_name} />
                    {b.status === "confirmed" && <ShortletRating bookingId={b.id} label="Rate this real guest" />}
                    {/* Real, direct fix for a genuine, confirmed gap:
                        a host had no real way to report an issue with
                        a guest — the dispute form existed for Owner
                        but was never wired into this new role. */}
                    {disputeSubmitted === b.id ? (
                      <p className="text-[10px] text-green-700 font-semibold mt-2">✓ Your real report has been submitted — CHS will review it.</p>
                    ) : disputingBookingId === b.id ? (
                      <div className="mt-2 bg-gray-50 rounded-lg p-2">
                        <RaiseDisputeForm
                          session={session!}
                          shortletBookingId={b.id}
                          againstUserId={b.guest_id}
                          onSuccess={() => { setDisputeSubmitted(b.id); setDisputingBookingId(null); }}
                          onCancel={() => setDisputingBookingId(null)}
                        />
                      </div>
                    ) : (
                      <button onClick={() => setDisputingBookingId(b.id)} className="text-[10px] text-chs-red underline mt-2">
                        ⚠️ Report an issue with this guest
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        <Link href="/wallet" className="block bg-white rounded-xl border border-gray-200 p-4 text-sm font-bold text-chs-charcoal text-center mt-4">
          💰 My Real Wallet &amp; Earnings →<InfoTip text="Every real naira you've earned from bookings, plus your real, spendable balance — see it, withdraw it, or fund it here." />
        </Link>
      </div>
    </div>
  );
}
