"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { uploadDocument } from "@/lib/storage";
import { formatNaira } from "@/lib/format";
import RoleBadge from "@/components/RoleBadge";

// Real, new page per direct client request: a genuine, comprehensive
// tenant register for agents/managers with tenants spread across many
// locations — full biodata, property details, and a real reference
// number for easy identification, plus real verification (ID, ID
// number, selfie) since a tenant should never be a "ghost."
interface RegisterEntry {
  id: string;
  reference_number: string;
  full_name: string;
  phone: string;
  location_area: string;
  street_address: string | null;
  property_type: string;
  bedrooms: number | null;
  annual_rent: number;
  occupation: string | null;
  id_type: string | null;
  id_number: string | null;
  id_document_url: string | null;
  selfie_url: string | null;
  created_at: string;
}

export default function TenantRegisterPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [annualRent, setAnnualRent] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [occupation, setOccupation] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  async function loadEntries() {
    const { data } = await supabase
      .from("tenant_register")
      .select("id, reference_number, full_name, phone, location_area, street_address, property_type, bedrooms, annual_rent, occupation, id_type, id_number, id_document_url, selfie_url, created_at")
      .order("created_at", { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  function resetForm() {
    setFullName(""); setPhone(""); setLocationArea(""); setStreetAddress("");
    setPropertyType(""); setBedrooms(""); setAnnualRent(""); setEmergencyName("");
    setEmergencyPhone(""); setOccupation(""); setIdType(""); setIdNumber("");
    setIdFile(null); setSelfieFile(null); setNotes("");
  }

  async function handleSubmit() {
    if (!session) return;
    if (!fullName.trim() || !phone.trim() || !locationArea.trim() || !propertyType.trim() || !annualRent) {
      setError("Please fill in the tenant's name, phone, location, property type, and annual rent.");
      return;
    }
    setSubmitting(true);
    setError(null);

    let idDocUrl: string | null = null;
    let selfieUrl: string | null = null;
    if (idFile) idDocUrl = await uploadDocument(idFile, session.user.id, "tenant-register-id");
    if (selfieFile) selfieUrl = await uploadDocument(selfieFile, session.user.id, "tenant-register-selfie");

    const { error: rpcError } = await supabase.rpc("add_tenant_register_entry", {
      p_full_name: fullName.trim(),
      p_phone: phone.trim(),
      p_location_area: locationArea.trim(),
      p_street_address: streetAddress.trim() || null,
      p_property_type: propertyType.trim(),
      p_bedrooms: bedrooms ? Number(bedrooms) : null,
      p_annual_rent: Number(annualRent),
      p_emergency_contact_name: emergencyName.trim() || null,
      p_emergency_contact_phone: emergencyPhone.trim() || null,
      p_occupation: occupation.trim() || null,
      p_id_type: idType.trim() || null,
      p_id_number: idNumber.trim() || null,
      p_id_document_url: idDocUrl,
      p_selfie_url: selfieUrl,
      p_notes: notes.trim() || null,
    });

    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    resetForm();
    setShowForm(false);
    loadEntries();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen zone-agent bg-[var(--zone-bg)] pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/agent" className="text-xs text-white/70">← Back to Agent Dashboard</Link>
        <RoleBadge label="Tenant Register" />
        <h1 className="font-serif text-lg font-bold mt-1">My Tenant Register</h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        <button onClick={() => setShowForm(!showForm)} className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold">
          {showForm ? "Cancel" : "+ Add a real tenant to my register"}
        </button>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-xs font-bold text-chs-charcoal">Tenant details</p>
            <input type="text" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="text" placeholder="Location area (e.g. Asokoro)" value={locationArea} onChange={(e) => setLocationArea(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="text" placeholder="Street address / house number" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <div className="flex gap-2">
              <input type="text" placeholder="Property type (e.g. Flat)" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <input type="number" placeholder="Bedrooms" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}
                className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
            <input type="number" placeholder="Annual rent (₦)" value={annualRent} onChange={(e) => setAnnualRent(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />

            <p className="text-xs font-bold text-chs-charcoal pt-2">Emergency contact (optional)</p>
            <input type="text" placeholder="Emergency contact name" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="tel" placeholder="Emergency contact phone" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="text" placeholder="Occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />

            <p className="text-xs font-bold text-chs-charcoal pt-2">Real verification — so no tenant is a ghost</p>
            <input type="text" placeholder="ID type (e.g. National ID, Voter's Card)" value={idType} onChange={(e) => setIdType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="text" placeholder="ID number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <div>
              <label className="text-[11px] text-gray-500">Soft copy of ID (photo/scan)</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)} className="w-full text-xs mt-1" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500">Selfie or passport photo</label>
              <input type="file" accept="image/*" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} className="w-full text-xs mt-1" />
            </div>

            <textarea placeholder="Any other notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />

            {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {submitting ? "Saving..." : "Save to my real register"}
            </button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-bold text-chs-charcoal">My Register ({entries.length})</p>
          {entries.length === 0 ? (
            <p className="text-xs text-gray-400">No real tenants recorded yet.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-chs-charcoal">{e.full_name}</p>
                  <span className="text-[9px] font-bold bg-chs-amber-light text-chs-amber-dark px-1.5 py-0.5 rounded-full">{e.reference_number}</span>
                </div>
                <p className="text-[11px] text-gray-500">{e.phone}</p>
                <p className="text-[11px] text-gray-500">
                  {e.street_address ? `${e.street_address} — ` : ""}{e.location_area} · {e.bedrooms ? `${e.bedrooms}-bed ` : ""}{e.property_type}
                </p>
                <p className="text-[11px] text-gray-600 font-semibold mt-0.5">{formatNaira(e.annual_rent)}/year</p>
                <div className="flex gap-2 mt-1.5">
                  {e.id_document_url && <a href={e.id_document_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-chs-red underline">View ID</a>}
                  {e.selfie_url && <a href={e.selfie_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-chs-red underline">View selfie</a>}
                  {!e.id_document_url && !e.selfie_url && <span className="text-[10px] text-gray-400">No verification uploaded yet</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
