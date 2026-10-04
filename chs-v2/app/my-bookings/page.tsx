"use client";

import { embeddedOne } from "@/lib/embedded";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { GuestShortletConfirmation } from "@/components/ShortletCheckInOut";
import ShortletMessageThread from "@/components/ShortletMessageThread";
import BookingStageCard from "@/components/BookingStageCard";

interface Booking {
  id: string;
  check_in: string;
  check_out: string;
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
export default function MyBookingsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  // Room number and type, looked up separately (small public tables).
  const [roomLabel, setRoomLabel] = useState<Record<string, string>>({});
  const [typeName, setTypeName] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function loadBookings() {
    if (!session) return;
    const { data } = await supabase
      .from("shortlet_bookings")
      .select("id, check_in, check_out, total_price, status, payment_status, hold_expires_at, booking_lane, expected_arrival_time, guest_commission_amount, security_deposit_amount, unit_id, room_type_id, properties(title)")
      .eq("guest_id", session.user.id)
      .order("check_in", { ascending: false });
    const list = (data as unknown as Booking[]) || [];
    setBookings(list);
    const unitIds = list.map((b) => b.unit_id).filter(Boolean) as string[];
    const typeIds = list.map((b) => b.room_type_id).filter(Boolean) as string[];
    if (unitIds.length > 0) {
      const { data: units } = await supabase.from("property_units").select("id, label").in("id", unitIds);
      setRoomLabel(Object.fromEntries((units || []).map((u) => [u.id, u.label])));
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
                <p className="text-sm font-bold text-chs-charcoal">{embeddedOne(b.properties)?.title || "Property"}</p>
                <p className="text-xs text-gray-500">{b.check_in} → {b.check_out}</p>
                <p className="text-xs text-gray-500">{formatNaira(b.total_price)} stay</p>
                <BookingStageCard booking={b} onChanged={loadBookings} />
                {/* The room is only named once the host has confirmed: until
                    then it is a request, and the host may still move you. */}
                {b.status === "confirmed" && b.unit_id && roomLabel[b.unit_id] && roomLabel[b.unit_id] !== "Whole property" && (
                  <p className="text-xs font-semibold text-chs-charcoal mt-0.5">🛏️ Your room: {roomLabel[b.unit_id]}{b.room_type_id && typeName[b.room_type_id] ? ` (${typeName[b.room_type_id]})` : ""}</p>
                )}
                {["awaiting_admin_relay", "pending_host_review", "awaiting_payment"].includes(b.status) && b.room_type_id && typeName[b.room_type_id] && (
                  <p className="text-[11px] text-gray-500 mt-0.5">Requested: {typeName[b.room_type_id]} room — a specific room is named once the host confirms.</p>
                )}
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
