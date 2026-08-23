"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { startRoadmapFunding } from "@/lib/paystack";

// The frontend for backend-v2/57_construction_roadmap.sql — built from
// two independently-produced specs, cross-checked against each other.
// Real geometry (footprint, block counts, roof area) for all 7
// reference configurations. The cost figure shown is a general,
// sourced 2026 market range — NOT a firm CHS quotation, since neither
// source document contained real Kaduna market rates. That's disclosed
// directly on the page, not hidden in fine print.

interface ReferenceModel {
  id: string;
  building_form: "bungalow" | "duplex";
  bedrooms: number;
  gross_footprint_sqm: number;
  total_floor_sqm: number;
  external_225mm_blocks: number | null;
  internal_150mm_blocks: number | null;
  approx_roof_sqm: number | null;
  bathroom_note: string | null;
}
interface Permit {
  permit_name: string;
  responsible_party: string;
  typical_processing_days: number | null;
  lifecycle_stage: string | null;
}
interface Milestone {
  stage_label: string;
  percentage_of_total: number;
  note: string | null;
}

export default function ConstructionRoadmapPage() {
  const { session, profile, loading: authLoading } = useAuth();
  const [models, setModels] = useState<ReferenceModel[]>([]);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: modelsData }, { data: permitsData }, { data: milestonesData }, { data: settingsData }] = await Promise.all([
        supabase.from("construction_reference_models").select("*").order("sort_order"),
        supabase.from("construction_permits_checklist").select("*").order("sort_order"),
        supabase.from("construction_payment_milestones").select("*").order("sort_order"),
        supabase.from("platform_settings").select("key, value").in("key", [
          "construction_cost_low_per_sqm", "construction_cost_high_per_sqm", "construction_cost_source_note",
          "construction_roadmap_access_fee", "construction_roadmap_access_note",
          "construction_retention_percentage", "construction_retention_note",
          "construction_change_order_markup", "construction_change_order_note",
        ]),
      ]);
      setModels(modelsData || []);
      setPermits(permitsData || []);
      setMilestones(milestonesData || []);
      setSettings(Object.fromEntries((settingsData || []).map((s) => [s.key, s.value])));
      if (modelsData && modelsData.length > 0) setSelectedId(modelsData[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!session || models.length === 0) return;
    (async () => {
      const results: Record<string, boolean> = {};
      for (const m of models) {
        const { data } = await supabase.rpc("has_roadmap_access", { p_model_id: m.id });
        results[m.id] = !!data;
      }
      setUnlocked(results);
    })();
  }, [session, models]);

  async function handleUnlock() {
    if (!session || !selectedId) return;
    setUnlocking(true);
    setError(null);
    try {
      await startRoadmapFunding(
        selectedId,
        () => {
          setUnlocking(false);
          setTimeout(() => setUnlocked((prev) => ({ ...prev, [selectedId]: true })), 2000);
        },
        () => setUnlocking(false)
      );
    } catch {
      setUnlocking(false);
      setError("Could not start payment. Please try again.");
    }
  }

  // Pre-launch admin testing tool ONLY — see the real note in
  // AuthContext.tsx and backend-v2/63_construction_roadmap_test_bypass.sql.
  // Skips Paystack entirely; marked is_test_grant = true in the
  // database so this is never confused with a real payment. Remove
  // this button (and the underlying function) before real launch.
  async function handleTestUnlock() {
    if (!selectedId) return;
    setUnlocking(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("grant_roadmap_access_test", { p_model_id: selectedId });
    setUnlocking(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setUnlocked((prev) => ({ ...prev, [selectedId]: true }));
  }

  const selected = models.find((m) => m.id === selectedId);
  const isUnlocked = selectedId ? unlocked[selectedId] : false;
  const accessFee = Number(settings.construction_roadmap_access_fee || 15000);
  const costLow = selected ? Number(settings.construction_cost_low_per_sqm || 120000) * selected.total_floor_sqm : 0;
  const costHigh = selected ? Number(settings.construction_cost_high_per_sqm || 250000) * selected.total_floor_sqm : 0;

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/engage-chs" className="text-xs text-gray-400">← Back to Engage CHS</Link>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mt-1 mb-1">🏗️ Construction Roadmap</h1>
        <p className="text-sm text-gray-500 mb-4">
          Real quantities, permits checklist, and payment plan for building from scratch — for new construction, not renovation.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`text-left rounded-xl p-3 border-2 ${
                selectedId === m.id ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"
              }`}
            >
              <p className="text-sm font-bold text-chs-charcoal">
                {m.bedrooms}-Bedroom {m.building_form === "duplex" ? "Duplex" : "Bungalow"}
              </p>
              <p className="text-[10px] text-gray-400">{m.total_floor_sqm} m² total floor</p>
              {unlocked[m.id] && <p className="text-[10px] text-green-600 font-semibold mt-0.5">✓ Unlocked</p>}
            </button>
          ))}
        </div>

        {selected && (
          <>
            {!session ? (
              <div className="bg-white rounded-xl border-2 border-gray-200 p-4 text-center">
                <p className="text-sm text-gray-500 mb-3">Log in to view or unlock this roadmap.</p>
                <Link href="/login" className="text-sm font-semibold text-chs-red">Log in →</Link>
              </div>
            ) : !isUnlocked ? (
              <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
                <p className="text-sm font-bold text-chs-charcoal">
                  {selected.bedrooms}-Bedroom {selected.building_form === "duplex" ? "Duplex" : "Bungalow"} — Preview
                </p>
                <p className="text-xs text-gray-500">
                  Gross footprint: {selected.gross_footprint_sqm} m² · {selected.bathroom_note}
                </p>
                <p className="text-xs text-gray-400">
                  Unlock for the full room-by-room quantity breakdown, the real Kaduna permits checklist, the milestone
                  payment plan, and an estimated cost range.
                </p>
                {error && <p className="text-xs text-chs-red bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <button onClick={handleUnlock} disabled={unlocking}
                  className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
                  {unlocking ? "Opening..." : `Unlock — ${formatNaira(accessFee)}`}
                </button>
                {profile?.is_super_admin && (
                  <button onClick={handleTestUnlock} disabled={unlocking}
                    className="w-full py-2.5 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold disabled:opacity-50">
                    🧪 Unlock for testing (no payment) — super admin only
                  </button>
                )}
                <p className="text-[10px] text-gray-400 text-center">
                  {settings.construction_roadmap_access_note}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
                  <p className="text-sm font-bold text-chs-charcoal mb-2">Real quantities (this configuration)</p>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>Gross footprint: {selected.gross_footprint_sqm} m²</p>
                    <p>Total floor area: {selected.total_floor_sqm} m²{selected.building_form === "duplex" && " (two floors)"}</p>
                    {selected.external_225mm_blocks && <p>External 225mm blocks: ~{selected.external_225mm_blocks}</p>}
                    {selected.internal_150mm_blocks && <p>Internal 150mm blocks: ~{selected.internal_150mm_blocks}</p>}
                    {selected.approx_roof_sqm && <p>Approx. roof surface: ~{selected.approx_roof_sqm} m²</p>}
                    <p>{selected.bathroom_note}</p>
                  </div>
                </div>

                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-amber-800 mb-1">Estimated cost range</p>
                  <p className="text-lg font-bold text-chs-charcoal">{formatNaira(costLow)} – {formatNaira(costHigh)}</p>
                  <p className="text-[10px] text-amber-700 mt-1">{settings.construction_cost_source_note}</p>
                </div>

                <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
                  <p className="text-sm font-bold text-chs-charcoal mb-2">Permits checklist (Kaduna)</p>
                  {permits.map((p) => (
                    <div key={p.permit_name} className="text-xs text-gray-600 mb-2 pb-2 border-b border-gray-100 last:border-0">
                      <p className="font-semibold text-chs-charcoal">{p.permit_name}</p>
                      <p className="text-[10px] text-gray-400">
                        {p.responsible_party === "chs" ? "CHS handles this" : p.responsible_party === "client" ? "Client provides" : "Joint"}
                        {p.typical_processing_days && ` · ~${p.typical_processing_days} days`}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
                  <p className="text-sm font-bold text-chs-charcoal mb-2">Payment plan</p>
                  {milestones.map((m) => (
                    <div key={m.stage_label} className="flex justify-between text-xs text-gray-600 mb-1.5">
                      <span>{m.stage_label}</span>
                      <span className="font-semibold text-chs-charcoal">{m.percentage_of_total}%</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
                    {settings.construction_retention_percentage}% retention held per milestone. {settings.construction_retention_note}
                  </p>
                </div>

                <Link href="/engage-chs"
                  className="block w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold text-center">
                  Start this project with CHS →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
