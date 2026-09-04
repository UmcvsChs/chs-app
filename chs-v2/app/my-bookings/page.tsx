"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { GuestShortletConfirmation } from "@/components/ShortletCheckInOut";
import ShortletMessageThread from "@/components/ShortletMessageThread";

interface Booking {
  id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  status: string;
  properties: { title: string }[] | null;
}

// Genuinely didn't exist before — there was no page anywhere for a
// real guest to see their own shortlet bookings or confirm a host's
// condition report. Open to any logged-in user, since booking a
// shortlet was never restricted to a single role.
export default function MyBookingsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadBookings() {
    if (!session) return;
    const { data } = await supabase
      .from("shortlet_bookings")
      .select("id, check_in, check_out, total_price, status, properties(title)")
      .eq("guest_id", session.user.id)
      .order("check_in", { ascending: false });
    setBookings((data as unknown as Booking[]) || []);
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

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <button onClick={() => router.back()} className="text-xs text-gray-400 mb-4 inline-block">← Back</button>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">🏠 My Shortlet Bookings</h1>
        <Link href="/tenant" className="text-xs text-chs-red font-semibold underline mb-4 inline-block">
          Looking for a long-term rental instead? See My Rentals →
        </Link>

        {bookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No shortlet bookings yet.</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-bold text-chs-charcoal">{b.properties?.[0]?.title || "Property"}</p>
                <p className="text-xs text-gray-500">{b.check_in} → {b.check_out}</p>
                <p className="text-xs text-gray-500">{formatNaira(b.total_price)} · {b.status}</p>
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
