"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import CurrencyInput from "@/components/CurrencyInput";

interface EstateOverview {
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  owner_occupied_units: number;
  pending_disputes: number;
  pending_maintenance: number;
  service_charges_pending: number;
  service_charges_overdue: number;
  total_collected_this_month: number;
}

interface Unit {
  id: string;
  unit_label: string | null;
  title: string;
  price: number;
  bedrooms: number;
  verification_status: string;
  occupancy_type: string | null;
}

// The real "check our dashboard, see pending activities, and we know
// what to do" screen — one real place, not scattered across many.
export default function EstateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const estateId = params.id as string;
  const { session, loading: authLoading } = useAuth();

  const [estateName, setEstateName] = useState("");
  const [estateState, setEstateState] = useState("");
  const [estateAddress, setEstateAddress] = useState("");
  const [overview, setOverview] = useState<EstateOverview | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Real bulk unit upload — the actual answer to "how do we onboard
  // 500 units without adding them one at a time."
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [csvResult, setCsvResult] = useState<string | null>(null);

  // Real service charge — bill every real occupied unit at once.
  const [showBillAll, setShowBillAll] = useState(false);
  const [chargeAmount, setChargeAmount] = useState<number | "">("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeDueDate, setChargeDueDate] = useState("");
  const [billing, setBilling] = useState(false);
  const [billResult, setBillResult] = useState<string | null>(null);

  // Real, new feature: marking a specific unit as owner-occupied — no
  // rental tenancy at all, matching a genuine Nigerian estate pattern
  // (e.g. a monetization scheme) that the previous system had no way
  // to represent.
  const [settingOccupantUnitId, setSettingOccupantUnitId] = useState<string | null>(null);
  const [occupantPhone, setOccupantPhone] = useState("");
  const [settingOccupant, setSettingOccupant] = useState(false);
  const [occupantResult, setOccupantResult] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, estateId]);

  async function loadData() {
    if (!session) return;
    const [{ data: estate }, { data: overviewData }, { data: unitsData }] = await Promise.all([
      supabase.from("estates").select("name, state, address").eq("id", estateId).maybeSingle(),
      supabase.rpc("get_estate_overview", { p_estate_id: estateId }),
      supabase.from("properties").select("id, unit_label, title, price, bedrooms, verification_status, occupancy_type").eq("estate_id", estateId).order("unit_label"),
    ]);
    if (estate) {
      setEstateName(estate.name);
      setEstateState(estate.state);
      setEstateAddress(estate.address);
    }
    setOverview(overviewData || null);
    setUnits(unitsData || []);
    setLoading(false);
  }

  // Real, dependency-free CSV parsing — expects a simple header row:
  // unit_label,unit_type,purpose,price,bedrooms
  async function handleCsvUpload() {
    if (!csvFile || !session) return;
    setUploadingCsv(true);
    setCsvResult(null);

    const text = await csvFile.text();
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const requiredCols = ["unit_label", "unit_type", "purpose", "price", "bedrooms"];
    const missing = requiredCols.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      setCsvResult(`Missing real columns in your CSV: ${missing.join(", ")}. Required header row: ${requiredCols.join(",")}`);
      setUploadingCsv(false);
      return;
    }

    const idx = (col: string) => header.indexOf(col);
    let created = 0;
    let failed = 0;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = lines[i].split(",").map((c) => c.trim());
      const unitLabel = cols[idx("unit_label")];
      const unitType = cols[idx("unit_type")];
      const purpose = cols[idx("purpose")] || "rent";
      const price = Number(cols[idx("price")]);
      const bedrooms = Number(cols[idx("bedrooms")]) || 0;

      if (!unitLabel || !unitType || !price) {
        failed++;
        continue;
      }

      const { error: insertError } = await supabase.from("properties").insert({
        owner_id: session.user.id,
        estate_id: estateId,
        unit_label: unitLabel,
        title: `${unitType} — ${unitLabel}`,
        description: `Real unit within ${estateName}, managed by CHS.`,
        purpose,
        property_type: unitType,
        price,
        bedrooms,
        location_state: estateState,
        location_area: estateAddress,
        status: "active",
        verification_status: "pending",
      });
      if (insertError) failed++;
      else created++;
    }

    setCsvResult(`✓ ${created} real unit${created !== 1 ? "s" : ""} created${failed > 0 ? `, ${failed} row(s) failed — check required columns and try again for those rows` : ""}.`);
    setUploadingCsv(false);
    setCsvFile(null);
    loadData();
  }

  async function handleBillAllOccupied() {
    if (!chargeAmount || !chargeDescription.trim() || !chargeDueDate) {
      setBillResult("Please fill in the amount, description, and due date.");
      return;
    }
    setBilling(true);
    setBillResult(null);

    // Real, corrected billing — reaches both a genuine tenant and a
    // genuine owner-occupier (someone who owns their unit outright,
    // e.g. under a monetization scheme, with no rental tenancy at
    // all). The previous version only ever billed active tenancies,
    // silently skipping owner-occupied units entirely.
    const { data: billed, error: billError } = await supabase.rpc("bill_all_occupied_estate_units", {
      p_estate_id: estateId,
      p_amount: chargeAmount,
      p_description: chargeDescription.trim(),
      p_due_date: chargeDueDate,
    });

    if (billError) {
      setBillResult(billError.message);
      setBilling(false);
      return;
    }

    setBillResult(`✓ Billed ${billed} real occupied unit${billed !== 1 ? "s" : ""} — ${formatNaira(Number(chargeAmount))} each.`);
    setBilling(false);
    setChargeAmount("");
    setChargeDescription("");
    loadData();
  }

  async function handleSetOwnerOccupier(propertyId: string) {
    if (!occupantPhone.trim()) return;
    setSettingOccupant(true);
    setOccupantResult(null);

    const { data: occupantProfile } = await supabase.from("profiles").select("id, full_name").eq("phone", occupantPhone.trim()).maybeSingle();
    if (!occupantProfile) {
      setOccupantResult("No real, registered CHS account found with that phone number. They need a real account first.");
      setSettingOccupant(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("set_unit_owner_occupier", { p_property_id: propertyId, p_occupant_id: occupantProfile.id });
    setSettingOccupant(false);
    if (rpcError) {
      setOccupantResult(rpcError.message);
      return;
    }
    setOccupantResult(`✓ ${occupantProfile.full_name} is now registered as the real owner-occupier of this unit.`);
    setOccupantPhone("");
    loadData();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-manager bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/manager/estates" className="text-xs text-gray-400 mb-4 inline-block">← Back to My Estates</Link>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-4">🏘️ {estateName}</h1>

        {overview && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-xl font-bold text-chs-charcoal">{overview.total_units}</p>
              <p className="text-[10px] text-gray-400">Total units</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-xl font-bold text-green-600">{overview.occupied_units}</p>
              <p className="text-[10px] text-gray-400">Occupied</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-xl font-bold text-chs-amber-dark">{overview.vacant_units}</p>
              <p className="text-[10px] text-gray-400">Vacant</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-xl font-bold text-chs-charcoal">{overview.owner_occupied_units}</p>
              <p className="text-[10px] text-gray-400">Owner-occupied</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-xl font-bold text-chs-charcoal">{formatNaira(overview.total_collected_this_month)}</p>
              <p className="text-[10px] text-gray-400">Collected this month</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-100 p-3 text-center">
              <p className="text-xl font-bold text-chs-red">{overview.pending_disputes}</p>
              <p className="text-[10px] text-gray-400">Open disputes</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-100 p-3 text-center">
              <p className="text-xl font-bold text-chs-red">{overview.pending_maintenance}</p>
              <p className="text-[10px] text-gray-400">Pending maintenance</p>
            </div>
          </div>
        )}

        {/* Real bulk onboarding — the actual answer to 500 units */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <p className="text-sm font-bold text-chs-charcoal mb-1">📥 Bulk-add units (CSV)</p>
          <p className="text-[10px] text-gray-400 mb-2">
            Required columns, exactly: <code>unit_label,unit_type,purpose,price,bedrooms</code>. One row per real
            unit — add all 500 at once instead of one at a time.
          </p>
          <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            className="w-full text-xs mb-2" />
          <button onClick={handleCsvUpload} disabled={uploadingCsv || !csvFile}
            className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
            {uploadingCsv ? "Uploading..." : "Upload units"}
          </button>
          {csvResult && <p className="text-[10px] text-gray-600 mt-2">{csvResult}</p>}
        </div>

        {/* Real service charge billing */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-bold text-chs-charcoal">💰 Service charges</p>
            {!showBillAll && (
              <button onClick={() => setShowBillAll(true)} className="text-[10px] font-semibold text-chs-red underline">
                Bill all occupied units
              </button>
            )}
          </div>
          {showBillAll && (
            <div className="space-y-2">
              <CurrencyInput value={chargeAmount} onChange={setChargeAmount} placeholder="Amount per unit (₦)" />
              <input type="text" value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)}
                placeholder="e.g. Q3 security and common area maintenance"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <input type="date" value={chargeDueDate} onChange={(e) => setChargeDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              {billResult && <p className="text-[10px] text-gray-600">{billResult}</p>}
              <div className="flex gap-2">
                <button onClick={() => setShowBillAll(false)} className="flex-1 py-2 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">
                  Cancel
                </button>
                <button onClick={handleBillAllOccupied} disabled={billing} className="flex-1 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                  {billing ? "Billing..." : "Bill all occupied units"}
                </button>
              </div>
            </div>
          )}
          {!showBillAll && (
            <p className="text-[10px] text-gray-400">
              {overview?.service_charges_pending || 0} pending, {overview?.service_charges_overdue || 0} overdue right now.
            </p>
          )}
        </div>

        {/* Real unit list */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-bold text-chs-charcoal mb-2">Units ({units.length})</p>
          {units.length === 0 ? (
            <p className="text-xs text-gray-400">No units yet — upload a CSV above to get started.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {units.map((u) => (
                <div key={u.id} className="text-xs border-b border-gray-100 pb-1.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-chs-charcoal">{u.unit_label || u.title}</p>
                      <p className="text-[10px] text-gray-400">{u.bedrooms} bed · {formatNaira(u.price)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {u.occupancy_type === "owner_occupier" && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-green-700 bg-green-50">Owner-occupied</span>
                      )}
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        u.verification_status === "verified" ? "text-green-700 bg-green-50" : "text-chs-amber-dark bg-chs-amber-light"
                      }`}>
                        {u.verification_status}
                      </span>
                    </div>
                  </div>
                  {u.occupancy_type !== "owner_occupier" && (
                    <div className="mt-1">
                      {settingOccupantUnitId === u.id ? (
                        <div className="flex gap-1.5 mt-1">
                          <input type="tel" placeholder="Occupant's real CHS phone number" value={occupantPhone}
                            onChange={(e) => setOccupantPhone(e.target.value)}
                            className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-[10px]" />
                          <button onClick={() => handleSetOwnerOccupier(u.id)} disabled={settingOccupant}
                            className="px-2 py-1 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                            Set
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setSettingOccupantUnitId(u.id); setOccupantResult(null); }}
                          className="text-[9px] text-chs-red underline">
                          Mark as owner-occupied (no rental tenancy)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {occupantResult && <p className="text-[10px] text-gray-600 mt-2">{occupantResult}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
