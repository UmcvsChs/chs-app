"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";
import PropertyCard from "@/components/PropertyCard";
import { Property } from "@/types/property";
import { GuestShortletConfirmation } from "@/components/ShortletCheckInOut";
import ShortletMessageThread from "@/components/ShortletMessageThread";
import RaiseDisputeForm from "@/components/RaiseDisputeForm";
import ShortletRating from "@/components/ShortletRating";
import CancelBookingButton from "@/components/CancelBookingButton";

// Real, new dashboard completing the real symmetry the client
// directly pointed out: Host just got its own real, dedicated
// interface — Guest, its real, direct counterpart in the same "double
// entry" model (Host <-> Guest, Owner <-> Buyer/Tenant), genuinely
// didn't have the equivalent yet. Reuses the exact same, already-
// proven booking and messaging logic from My Bookings, rather than
// rebuilding it, wrapped in a real, identified dashboard home.
//
// Real, direct fix per client feedback: the first version of this
// page sent a Guest right back to the generic homepage to "browse" —
// genuinely no different from what didn't work before. This shows
// the real, actually-relevant categories (Hotel & Lodge, Event
// Centre, Shortlet, Recreational/Sports, casual Car Park) directly,
// live, right here — not a link elsewhere to filter it themselves
// again.
interface Booking {
  id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  status: string;
  properties: { title: string; owner_id: string }[] | null;
}

const GUEST_CATEGORIES = [
  { key: "shortlet", label: "🏠 Shortlet Apartments", match: (p: Property) => p.purpose === "shortlet" },
  { key: "hotel_lodge", label: "🏨 Hotels & Lodges", match: (p: Property) => p.purpose === "hire" && p.hire_category === "hotel_lodge" },
  { key: "event_centre", label: "🎪 Event Centres & Halls", match: (p: Property) => p.purpose === "hire" && p.hire_category === "event_centre" },
  { key: "recreational_sports", label: "⚽ Recreational & Sports", match: (p: Property) => p.purpose === "hire" && p.hire_category === "recreational_sports" },
  { key: "car_park_casual", label: "🚗 Casual Car Parks", match: (p: Property) => p.purpose === "hire" && p.hire_category === "car_park_casual" },
  { key: "cinema_entertainment", label: "🎬 Cinema & Entertainment", match: (p: Property) => p.purpose === "hire" && p.hire_category === "cinema_entertainment" },
];

export default function GuestDashboardPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [disputingBookingId, setDisputingBookingId] = useState<string | null>(null);
  const [disputeSubmitted, setDisputeSubmitted] = useState<string | null>(null);
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    Promise.all([
      supabase
        .from("shortlet_bookings")
        .select("id, check_in, check_out, total_price, status, properties(title, owner_id)")
        .eq("guest_id", session.user.id)
        .order("check_in", { ascending: false }),
      // Real, direct fetch of exactly the categories relevant to a
      // Guest — a genuine, live database query, not a static link.
      supabase
        .from("properties")
        .select("*")
        .eq("status", "active")
        .or("purpose.eq.shortlet,and(purpose.eq.hire,hire_category.not.is.null)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]).then(([bookingsRes, listingsRes]) => {
      setBookings((bookingsRes.data as unknown as Booking[]) || []);
      setListings((listingsRes.data as unknown as Property[]) || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10 zone-guest">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
        <RoleBadge label="Guest" />
        <h1 className="font-serif text-lg font-bold mt-1">My Guest Dashboard</h1>
        <p className="text-xs text-white/60 mt-1">Shortlet, hotel/event, and casual hire bookings — a real, different kind of stay from renting or buying.</p>
      </div>

      <div className="px-4 py-4 space-y-2">
        {bookings.length > 0 && (
          <>
            <p className="text-xs font-bold text-chs-charcoal">📋 My Real Bookings ({bookings.length})</p>
            {bookings.map((b) => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
                <p className="text-sm font-semibold text-chs-charcoal">{b.properties?.[0]?.title || "Property"}</p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">{b.check_in} → {b.check_out}</p>
                  <p className="text-xs font-bold text-chs-charcoal">{formatNaira(b.total_price)}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full inline-block mt-1 ${b.status === "pending_host_review" ? "text-chs-red bg-chs-amber-light" : "text-gray-500 bg-gray-100"}`}>
                  {b.status === "pending_host_review" ? "⏳ Awaiting host decision" : b.status}
                </span>
                {(b.status === "pending_host_review" || b.status === "confirmed") && (
                  <CancelBookingButton bookingId={b.id} onCancelled={() => setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, status: "cancelled" } : x))} />
                )}
                {b.status === "confirmed" && <ShortletRating bookingId={b.id} label="Rate your real stay with this host" />}
                <GuestShortletConfirmation bookingId={b.id} />
                <ShortletMessageThread bookingId={b.id} viewerRole="guest" />
                {/* Real, direct fix for a genuine, confirmed gap: a
                    real dispute-raising form already existed and
                    worked for Tenant and Owner, but Guest was never
                    wired into it. */}
                {disputeSubmitted === b.id ? (
                  <p className="text-[10px] text-green-700 font-semibold mt-2">✓ Your real concern has been submitted — CHS will review it.</p>
                ) : disputingBookingId === b.id ? (
                  <div className="mt-2 bg-gray-50 rounded-lg p-2">
                    <RaiseDisputeForm
                      session={session!}
                      shortletBookingId={b.id}
                      againstUserId={b.properties?.[0]?.owner_id || null}
                      onSuccess={() => { setDisputeSubmitted(b.id); setDisputingBookingId(null); }}
                      onCancel={() => setDisputingBookingId(null)}
                    />
                  </div>
                ) : (
                  <button onClick={() => setDisputingBookingId(b.id)} className="text-[10px] text-chs-red underline mt-2">
                    ⚠️ Raise a concern about this booking
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {GUEST_CATEGORIES.map((cat) => {
          const items = listings.filter(cat.match);
          if (items.length === 0) return null;
          return (
            <div key={cat.key} className="mt-4">
              <p className="text-xs font-bold text-chs-charcoal mb-2">{cat.label} ({items.length})</p>
              <div className="grid grid-cols-2 gap-3">
                {items.map((p) => <PropertyCard key={p.id} property={p} />)}
              </div>
            </div>
          );
        })}

        {listings.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No real shortlet, hotel, or venue listings available right now.</p>
        )}

        <Link href="/wallet" className="block bg-white rounded-xl border border-gray-200 p-4 text-sm font-bold text-chs-charcoal text-center mt-4">
          💰 My Real Wallet →
        </Link>
      </div>
    </div>
  );
}
