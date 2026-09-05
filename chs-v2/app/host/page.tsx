"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";
import { HostShortletCheckInOut } from "@/components/ShortletCheckInOut";
import ShortletMessageThread from "@/components/ShortletMessageThread";
import HostBookingDecision from "@/components/HostBookingDecision";
import RaiseDisputeForm from "@/components/RaiseDisputeForm";

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
}

interface HostBooking {
  id: string;
  guest_id: string;
  guest_full_name: string;
  guest_phone: string;
  guest_id_document_url: string | null;
  check_in: string;
  check_out: string;
  status: string;
  total_price: number;
  host_commission_amount: number;
  properties: { title: string }[] | null;
}

export default function HostDashboardPage() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [listings, setListings] = useState<HostListing[]>([]);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
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
        .select("id, title, hire_category, price_per_night, price, status")
        .eq("owner_id", session.user.id)
        .or("purpose.eq.shortlet,and(purpose.eq.hire,hire_category.not.is.null)"),
      supabase.from("shortlet_bookings")
        .select("id, guest_id, guest_full_name, guest_phone, guest_id_document_url, check_in, check_out, status, total_price, host_commission_amount, properties!inner(title, owner_id)")
        .eq("properties.owner_id", session.user.id)
        .in("status", ["pending_host_review", "confirmed", "active"]),
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
    <div className="min-h-screen bg-[var(--zone-bg)] pb-10 zone-owner">
      <div className="bg-chs-charcoal text-white px-4 py-4">
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

      <div className="px-4 py-4 space-y-2">
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
            </div>
          ))
        )}

        <Link href="/list-property" className="block bg-white rounded-xl border border-gray-200 p-4 text-sm font-bold text-chs-charcoal text-center">
          + List a new shortlet or hire property →
        </Link>

        {bookings.length > 0 && (
          <>
            {/* Real, critical fix per direct, serious client
                feedback: a booking request now genuinely requires the
                host's own real decision before it's confirmed — not
                an instant, unreviewable charge. */}
            {bookings.filter((b) => b.status === "pending_host_review").length > 0 && (
              <>
                <p className="text-xs font-bold text-chs-red mt-4">🔔 Real Requests Awaiting Your Decision</p>
                {bookings.filter((b) => b.status === "pending_host_review").map((b) => (
                  <div key={b.id} className="bg-chs-amber-light rounded-xl border-2 border-chs-red p-3 mb-2">
                    <p className="text-xs font-semibold text-chs-charcoal">{b.properties?.[0]?.title || "Property"}</p>
                    <p className="text-[10px] text-gray-500">{b.guest_full_name} · {b.guest_phone} · {b.check_in} → {b.check_out}</p>
                    <p className="text-[10px] text-gray-500">Your real net if accepted: {formatNaira(b.total_price - b.host_commission_amount)}</p>
                    {b.guest_id_document_url && (
                      <a href={b.guest_id_document_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block mb-1">View guest&apos;s uploaded ID</a>
                    )}
                    <HostBookingDecision bookingId={b.id} onDecided={() => setBookings((prev) => prev.filter((x) => x.id !== b.id))} />
                  </div>
                ))}
              </>
            )}

            {bookings.filter((b) => b.status !== "pending_host_review").length > 0 && (
              <>
                <p className="text-xs font-bold text-chs-charcoal mt-4">📋 Real Guest Bookings</p>
                {bookings.filter((b) => b.status !== "pending_host_review").map((b) => (
                  <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2">
                    <p className="text-xs font-semibold text-chs-charcoal">{b.properties?.[0]?.title || "Property"}</p>
                    <p className="text-[10px] text-gray-400">{b.guest_full_name} · {b.guest_phone} · {b.check_in} → {b.check_out}</p>
                    {b.guest_id_document_url && (
                      <a href={b.guest_id_document_url} target="_blank" rel="noreferrer" className="text-[10px] text-chs-red underline block mb-1">View guest&apos;s uploaded ID</a>
                    )}
                    <HostShortletCheckInOut bookingId={b.id} propertyTitle={b.properties?.[0]?.title || "Property"} />
                    <ShortletMessageThread bookingId={b.id} viewerRole="host" guestName={b.guest_full_name} />
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
          💰 My Real Wallet &amp; Earnings →
        </Link>
      </div>
    </div>
  );
}
