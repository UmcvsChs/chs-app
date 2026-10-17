"use client";

import HostStayOffers from "@/components/HostStayOffers";
import ManageByChs from "@/components/ManageByChs";
import OpenVenueProfile from "@/components/OpenVenueProfile";
import NotificationBell from "@/components/NotificationBell";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDateTime } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";
import InfoTip from "@/components/InfoTip";
import HouseRulesUpload from "@/components/HouseRulesUpload";
import HostHotelTools from "@/components/HostHotelTools";
import HotelOperations from "@/components/HotelOperations";
import HostPlans from "@/components/HostPlans";
import HostConsole from "@/components/HostConsole";
import MarketplaceTile from "@/components/MarketplaceTile";
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
  if (hrs < 24) return { text: `📅 Calendar confirmed today (${formatDateTime(stamp)})`, className: "text-green-700" };
  const days = Math.floor(hrs / 24);
  return { text: `📅 Calendar last confirmed ${days} day${days !== 1 ? "s" : ""} ago (${formatDateTime(stamp)})`, className: days >= 3 ? "text-chs-red" : "text-amber-700" };
}

export default function HostDashboardPage() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [listings, setListings] = useState<HostListing[]>([]);
  const [confirmingCalendars, setConfirmingCalendars] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    supabase.from("properties")
      .select("id, title, hire_category, price_per_night, price, status, calendar_confirmed_at")
      .eq("owner_id", session.user.id)
      .or("purpose.eq.shortlet,and(purpose.eq.hire,hire_category.not.is.null)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setListings(data || []);
        setLoading(false);
      });
  }, [authLoading, session, router]);

  if (authLoading || loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  const overviewExtra = listings.length > 0 ? (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs font-bold text-chs-charcoal mb-0.5">📅 Keep your availability true</p>
      <p className="text-[11px] text-gray-500 mb-2">Guests book on what your calendars show. Once you&apos;ve recorded today&apos;s walk-ins, tap below — one tap covers every listing.</p>
      {calendarMsg && <p className="text-[11px] text-green-700 mb-2">{calendarMsg}</p>}
      <button onClick={handleConfirmAllCalendars} disabled={confirmingCalendars}
        className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
        {confirmingCalendars ? "Saving…" : "✓ All my calendars are accurate"}
      </button>
    </div>
  ) : null;

  const moneyNode = (
    <Link href="/wallet" className="block bg-white rounded-xl border border-gray-200 p-4 text-sm font-bold text-chs-charcoal text-center">
      💰 My Wallet &amp; Earnings →<InfoTip text="Every naira you've earned from bookings, plus your spendable balance — see it, withdraw it, or fund it here." />
    </Link>
  );

  const workNode = (
    <div className="space-y-2">
      <Link href="/host/arrivals" className="block bg-white rounded-xl border border-gray-200 p-3 text-sm font-bold text-chs-charcoal text-center">
        🛎️ Front Desk: today&apos;s arrivals &amp; check-in →
      </Link>
      <Link href="/host/work" className="block bg-white rounded-xl border border-gray-200 p-3 text-sm font-bold text-chs-charcoal text-center">
        📋 Work: duties, shift reports &amp; team →
      </Link>
      <HostPlans />
      <HostStaffManager />
    </div>
  );

  const listingsNode = (
    <div className="space-y-2">
      <p className="text-xs font-bold text-chs-charcoal">🏠 My Listings ({listings.length})</p>
      {listings.length === 0 ? (
        <p className="text-xs text-gray-400 mb-4">No shortlet or hire listings yet.</p>
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
            <div className="mt-2"><HouseRulesUpload propertyId={l.id} session={session} /></div>
            <HostHotelTools propertyId={l.id} />
            <HostStayOffers propertyId={l.id} />
            {["hotel_lodge", "event_centre", "open_field", "stadium", "cinema_entertainment", "recreational_sports"].includes(l.hire_category || "") && <div className="mt-2 border border-gray-200 rounded-xl bg-white p-3"><ManageByChs propertyId={l.id} defaultPurpose="hotel" hireCategory={l.hire_category} /></div>}
            {(l.hire_category === "open_field" || l.hire_category === "stadium") && <OpenVenueProfile propertyId={l.id} editable />}
            {l.hire_category === "hotel_lodge" && <HotelOperations propertyId={l.id} />}
            <Link href={`/host/calendar/${l.id}`} className="mt-2 block text-center py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold">
              Rooms &amp; calendar →
            </Link>
          </div>
        ))
      )}
      <Link href="/list-property" className="block bg-white rounded-xl border border-gray-200 p-4 text-sm font-bold text-chs-charcoal text-center">
        + List a new shortlet or hire property →<InfoTip text="A separate listing for short stays or casual hire — chalets, hotel rooms, event centres — priced per night or per booking, not per year like a normal rental." />
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10 zone-host">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <RoleBadge label="Host" />
        <div className="flex items-center gap-2"><h1 className="font-serif text-lg font-bold mt-1">My Host Dashboard</h1><NotificationBell /></div>
        <p className="text-xs text-white/60 mt-1">Shortlets, hotels &amp; lodges, event centres and casual hire: requests, payments, changes, services and stays in one place.</p>
        {[profile?.role, ...(profile?.secondary_roles || [])].includes("owner") && (
          <Link href="/owner" className="text-[10px] font-semibold text-white/70 underline mt-1 inline-block">
            Switch to my Owner dashboard →
          </Link>
        )}
      </div>

      <div className="px-4 pt-3"><MarketplaceTile /></div>
      <HostConsole session={session} listingsNode={listingsNode} workNode={workNode} overviewExtra={overviewExtra} moneyNode={moneyNode} />
    </div>
  );
}
