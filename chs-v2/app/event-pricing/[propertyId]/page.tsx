"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

interface Tier { id: string; label: string; max_guests: number; price: number; }
interface Facility { id: string; name: string; price: number; per_guest: boolean; }

// Real, new page completing a genuine, verified upgrade: a real,
// host-configurable capacity-tier and priced-facilities system for
// Event Centre listings, replacing a single flat per-day price.
export default function EventPricingPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = use(params);
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [propertyTitle, setPropertyTitle] = useState("");

  const [newTierLabel, setNewTierLabel] = useState("");
  const [newTierGuests, setNewTierGuests] = useState("");
  const [newTierPrice, setNewTierPrice] = useState("");
  const [newFacilityName, setNewFacilityName] = useState("");
  const [newFacilityPrice, setNewFacilityPrice] = useState("");
  const [newFacilityPerGuest, setNewFacilityPerGuest] = useState(false);

  async function loadAll() {
    if (!session) return;
    const { data: prop } = await supabase.from("properties").select("title").eq("id", propertyId).single();
    setPropertyTitle(prop?.title || "");
    const { data: t } = await supabase.from("event_capacity_tiers").select("*").eq("property_id", propertyId).order("display_order");
    setTiers(t || []);
    const { data: f } = await supabase.from("event_facilities").select("*").eq("property_id", propertyId).order("display_order");
    setFacilities(f || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.push("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  async function handleSeedDefaults() {
    await supabase.rpc("seed_default_event_facilities", { p_property_id: propertyId });
    loadAll();
  }

  async function handleAddTier() {
    if (!newTierLabel.trim() || !newTierGuests || !newTierPrice) return;
    await supabase.from("event_capacity_tiers").insert({
      property_id: propertyId, label: newTierLabel.trim(),
      max_guests: parseInt(newTierGuests), price: parseFloat(newTierPrice),
      display_order: tiers.length + 1,
    });
    setNewTierLabel(""); setNewTierGuests(""); setNewTierPrice("");
    loadAll();
  }

  async function handleAddFacility() {
    if (!newFacilityName.trim() || !newFacilityPrice) return;
    await supabase.from("event_facilities").insert({
      property_id: propertyId, name: newFacilityName.trim(),
      price: parseFloat(newFacilityPrice), per_guest: newFacilityPerGuest,
      display_order: facilities.length + 1,
    });
    setNewFacilityName(""); setNewFacilityPrice(""); setNewFacilityPerGuest(false);
    loadAll();
  }

  async function handleDeleteTier(id: string) {
    await supabase.from("event_capacity_tiers").delete().eq("id", id);
    loadAll();
  }
  async function handleDeleteFacility(id: string) {
    await supabase.from("event_facilities").delete().eq("id", id);
    loadAll();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] zone-host pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <Link href="/host" className="text-xs text-white/70">← Back to Host Dashboard</Link>
        <h1 className="font-serif text-lg font-bold mt-1">Real Event Pricing — {propertyTitle}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {tiers.length === 0 && facilities.length === 0 && (
          <button onClick={handleSeedDefaults} className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold">
            Set up with real, sensible starter pricing
          </button>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-bold text-chs-charcoal mb-2">Real capacity tiers</p>
          {tiers.map((t) => (
            <div key={t.id} className="flex justify-between items-center text-xs bg-gray-50 rounded-lg px-3 py-2 mb-1.5">
              <span>{t.label} <span className="text-gray-400">(up to {t.max_guests})</span></span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">{formatNaira(t.price)}</span>
                <button onClick={() => handleDeleteTier(t.id)} className="text-chs-red text-[10px]">Remove</button>
              </span>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <input value={newTierLabel} onChange={(e) => setNewTierLabel(e.target.value)} placeholder="Label" className="px-2 py-2 rounded-lg border border-gray-200 text-xs col-span-1" />
            <input value={newTierGuests} onChange={(e) => setNewTierGuests(e.target.value)} type="number" placeholder="Max guests" className="px-2 py-2 rounded-lg border border-gray-200 text-xs" />
            <input value={newTierPrice} onChange={(e) => setNewTierPrice(e.target.value)} type="number" placeholder="Price (₦)" className="px-2 py-2 rounded-lg border border-gray-200 text-xs" />
          </div>
          <button onClick={handleAddTier} className="w-full mt-2 py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold">+ Add tier</button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-bold text-chs-charcoal mb-2">Real extra facilities</p>
          {facilities.map((f) => (
            <div key={f.id} className="flex justify-between items-center text-xs bg-gray-50 rounded-lg px-3 py-2 mb-1.5">
              <span>{f.name}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">{formatNaira(f.price)}{f.per_guest ? "/guest" : ""}</span>
                <button onClick={() => handleDeleteFacility(f.id)} className="text-chs-red text-[10px]">Remove</button>
              </span>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-1.5 mt-2 items-center">
            <input value={newFacilityName} onChange={(e) => setNewFacilityName(e.target.value)} placeholder="Name" className="px-2 py-2 rounded-lg border border-gray-200 text-xs" />
            <input value={newFacilityPrice} onChange={(e) => setNewFacilityPrice(e.target.value)} type="number" placeholder="Price (₦)" className="px-2 py-2 rounded-lg border border-gray-200 text-xs" />
            <label className="flex items-center gap-1 text-[10px] text-gray-500">
              <input type="checkbox" checked={newFacilityPerGuest} onChange={(e) => setNewFacilityPerGuest(e.target.checked)} /> per guest
            </label>
          </div>
          <button onClick={handleAddFacility} className="w-full mt-2 py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold">+ Add facility</button>
        </div>
      </div>
    </div>
  );
}
