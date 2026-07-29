"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ConditionRoom } from "@/types/conditionReport";

function generateReference(): string {
  return "CHS-COND-" + Math.floor(1000 + Math.random() * 9000);
}

const CONDITION_OPTIONS = ["good", "fair", "poor"] as const;

export default function ConditionReportPage({
  params,
}: {
  params: Promise<{ tenancyId: string }>;
}) {
  const { tenancyId } = use(params);
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  const [rooms, setRooms] = useState<ConditionRoom[]>([
    { name: "Living Room", items: [{ item: "Walls", condition: "good" }], notes: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function addRoom() {
    setRooms([...rooms, { name: "", items: [{ item: "", condition: "good" }], notes: "" }]);
  }

  function updateRoomName(roomIndex: number, name: string) {
    const updated = [...rooms];
    updated[roomIndex].name = name;
    setRooms(updated);
  }

  function updateRoomNotes(roomIndex: number, notes: string) {
    const updated = [...rooms];
    updated[roomIndex].notes = notes;
    setRooms(updated);
  }

  function addItem(roomIndex: number) {
    const updated = [...rooms];
    updated[roomIndex].items.push({ item: "", condition: "good" });
    setRooms(updated);
  }

  function updateItem(roomIndex: number, itemIndex: number, field: "item" | "condition", value: string) {
    const updated = [...rooms];
    updated[roomIndex].items[itemIndex] = { ...updated[roomIndex].items[itemIndex], [field]: value };
    setRooms(updated as ConditionRoom[]);
  }

  function removeRoom(roomIndex: number) {
    setRooms(rooms.filter((_, i) => i !== roomIndex));
  }

  async function handleSubmit() {
    if (!session) return;
    const hasEmptyRoom = rooms.some((r) => !r.name.trim());
    if (hasEmptyRoom) {
      setError("Please name every room before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from("condition_reports").insert({
      reference: generateReference(),
      tenancy_id: tenancyId,
      rooms,
      tenant_confirmed: true,
      status: "pending_review",
      submitted_at: new Date().toISOString(),
    });

    if (insertError) {
      setError("Could not submit this report. Please try again.");
      setSubmitting(false);
      return;
    }

    setSuccess(true);
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-chs-charcoal mb-2">✓ Condition report submitted</p>
        <p className="text-sm text-gray-500 mb-4">
          This is now on record — a real, dated document both you and your landlord can refer back to.
        </p>
        <Link href="/tenant" className="text-sm font-semibold text-chs-red">Back to My Rentals</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 pb-16">
      <div className="max-w-md mx-auto">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">Move-in condition report</h1>
        <p className="text-sm text-gray-500 mb-6">
          Document the real condition of each room now — this genuinely protects both you and your
          landlord if a dispute ever comes up later.
        </p>

        {rooms.map((room, roomIndex) => (
          <div key={roomIndex} className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
            <div className="flex justify-between items-center mb-2">
              <input
                type="text"
                value={room.name}
                onChange={(e) => updateRoomName(roomIndex, e.target.value)}
                placeholder="Room name (e.g. Master Bedroom)"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold"
              />
              {rooms.length > 1 && (
                <button onClick={() => removeRoom(roomIndex)} className="ml-2 text-xs text-gray-400">
                  Remove
                </button>
              )}
            </div>

            {room.items.map((item, itemIndex) => (
              <div key={itemIndex} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={item.item}
                  onChange={(e) => updateItem(roomIndex, itemIndex, "item", e.target.value)}
                  placeholder="e.g. Walls, Windows, Flooring"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs"
                />
                <select
                  value={item.condition}
                  onChange={(e) => updateItem(roomIndex, itemIndex, "condition", e.target.value)}
                  className="px-2 py-2 rounded-lg border border-gray-200 text-xs bg-white"
                >
                  {CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
            <button onClick={() => addItem(roomIndex)} className="text-[10px] font-semibold text-chs-red">
              + Add item
            </button>

            <textarea
              value={room.notes}
              onChange={(e) => updateRoomNotes(roomIndex, e.target.value)}
              placeholder="Any additional notes about this room"
              rows={2}
              className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 text-xs"
            />
          </div>
        ))}

        <button onClick={addRoom} className="w-full py-2.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold mb-4">
          + Add another room
        </button>

        {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Confirm and submit report"}
        </button>
      </div>
    </div>
  );
}
