"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { uploadPropertyPhoto, uploadDocument } from "@/lib/storage";
import CurrencyInput from "@/components/CurrencyInput";

const DOC_TYPES = [
  { value: "ownership_document", label: "Ownership document" },
  { value: "kadgis", label: "KADGIS approval" },
  { value: "kasupda", label: "KASUPDA approval" },
  { value: "owner_id", label: "Owner's valid ID" },
  { value: "inheritance_consent", label: "Inheritance consent (if applicable)" },
];

const PURPOSE_OPTIONS = [
  { value: "sale", label: "For Sale" },
  { value: "rent", label: "For Rent" },
  { value: "lease", label: "For Lease" },
  { value: "hire", label: "For Hire" },
  { value: "shortlet", label: "Shortlet" },
];
const PROPERTY_TYPES = ["Apartment", "Duplex", "Bungalow", "Terrace", "Land", "Commercial"];
const NIGERIAN_STATES = ["Kaduna", "Abuja (FCT)", "Kano", "Lagos"];
const ROAD_TYPES = [
  { value: "tarred", label: "Tarred" },
  { value: "untarred_motorable", label: "Untarred but motorable" },
  { value: "untarred_difficult", label: "Untarred, difficult access" },
];

export default function ListPropertyPage() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();

  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("rent");
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]);
  const [locationArea, setLocationArea] = useState("");
  const [locationLga, setLocationLga] = useState("");
  const [locationState, setLocationState] = useState("Kaduna");
  const [price, setPrice] = useState<number | "">("");
  const [pricePerNight, setPricePerNight] = useState<number | "">("");
  const [pricePeriod, setPricePeriod] = useState("per year");
  const [description, setDescription] = useState("");
  const [bedrooms, setBedrooms] = useState<number | "">("");
  const [bathrooms, setBathrooms] = useState<number | "">("");
  const [fenced, setFenced] = useState(false);
  const [gated, setGated] = useState(false);
  const [roadType, setRoadType] = useState("tarred");
  const [electricityBackup, setElectricityBackup] = useState("");
  const [waterSource, setWaterSource] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [documents, setDocuments] = useState<Record<string, File | null>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A real access check — must be logged in, and genuinely be either an
  // Owner or an Agent (agents list on behalf of owners), matching the
  // real access rules already enforced by the database's own RLS.
  if (!authLoading && !session) {
    router.push("/login");
    return null;
  }
  const allRoles = profile ? [profile.role, ...(profile.secondary_roles || [])] : [];
  if (!authLoading && profile && !allRoles.includes("owner") && !allRoles.includes("agent")) {
    router.push("/");
    return null;
  }

  function validate(): string | null {
    if (!title.trim()) return "Please enter a title for this property.";
    if (!locationArea.trim()) return "Please enter the location area.";
    if (purpose === "shortlet") {
      if (!pricePerNight || pricePerNight < 1000) return "Please enter a valid nightly price.";
    } else {
      if (!price || price < 1000) return "Please enter a valid price.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!session) return;

    setError(null);
    setSubmitting(true);

    // Insert first — real photos need a real property ID to organise
    // under, so this genuinely can't be uploaded before the record
    // itself exists. Starts as unverified: a real person at CHS reviews
    // every new listing before it becomes publicly visible, matching
    // the real, database-enforced rule already built into this schema
    // (`properties_public_read_verified`) — not a cosmetic badge, an
    // actual access restriction the database itself enforces.
    const { data: newProperty, error: insertError } = await supabase
      .from("properties")
      .insert({
        owner_id: session.user.id,
        title: title.trim(),
        purpose,
        property_type: propertyType,
        location_area: locationArea.trim(),
        location_lga: locationLga.trim() || null,
        location_state: locationState,
        // `price` is required (not null) on every property regardless of
        // purpose — for a shortlet, the nightly rate is the genuine
        // price, so it populates both fields consistently rather than
        // leaving the required column empty.
        price: purpose === "shortlet" ? pricePerNight : price,
        price_per_night: purpose === "shortlet" ? pricePerNight : null,
        price_period: purpose === "sale" || purpose === "shortlet" ? null : pricePeriod,
        description: description.trim() || null,
        bedrooms: bedrooms || null,
        bathrooms: bathrooms || null,
        fenced,
        gated,
        road_type: roadType,
        electricity_backup: electricityBackup.trim() || null,
        water_source: waterSource.trim() || null,
        for_sale: purpose === "sale",
        photos: [],
        verification_status: "pending",
        status: "active",
      })
      .select()
      .single();

    if (insertError || !newProperty) {
      setError("Could not create this listing. Please try again.");
      setSubmitting(false);
      return;
    }

    // Real photo uploads, now that a real property ID exists to
    // organise them under.
    if (photos.length > 0) {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const url = await uploadPropertyPhoto(photos[i], session.user.id, newProperty.id, i);
        if (url) uploadedUrls.push(url);
      }
      if (uploadedUrls.length > 0) {
        await supabase.from("properties").update({ photos: uploadedUrls }).eq("id", newProperty.id);
      }
    }

    // Real verification documents — a genuine gap found and fixed: this
    // rebuild previously only uploaded photos, with nowhere for the
    // actual ownership document, KADGIS/KASUPDA approvals, or owner's ID
    // to go, meaning admin would have had nothing real to check when
    // verifying a listing.
    for (const [docType, file] of Object.entries(documents)) {
      if (!file) continue;
      const url = await uploadDocument(file, session.user.id, docType);
      if (url) {
        await supabase.from("property_documents").insert({
          property_id: newProperty.id,
          doc_type: docType,
          file_url: url,
        });
      }
    }

    // Sent to the Owner dashboard, not the property's own public detail
    // page — that page currently has no way to know it's really the
    // owner viewing their own not-yet-verified listing (a real,
    // disclosed limitation; see the README), so this avoids routing
    // someone straight into a confusing "Not found" for their own
    // brand-new property.
    router.push("/owner");
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">List a property</h1>
        <p className="text-sm text-gray-500 mb-6">
          CHS reviews every new listing before it goes live publicly.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 3-Bedroom Flat with BQ — Malali GRA"
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Purpose</label>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {PURPOSE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setPurpose(opt.value)}
                  className={`py-2 rounded-lg border-2 text-[10px] font-semibold ${purpose === opt.value ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Property type</label>
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Location area</label>
            <input type="text" value={locationArea} onChange={(e) => setLocationArea(e.target.value)}
              placeholder="e.g. Malali GRA" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">LGA</label>
            <input type="text" value={locationLga} onChange={(e) => setLocationLga(e.target.value)}
              placeholder="e.g. Kaduna North" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">State</label>
            <select value={locationState} onChange={(e) => setLocationState(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {purpose === "shortlet" ? (
            <div>
              <label className="text-xs font-semibold text-gray-600">Price per night (₦)</label>
              <CurrencyInput value={pricePerNight} onChange={setPricePerNight} placeholder="e.g. 45,000" />
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-gray-600">Price (₦)</label>
              <CurrencyInput value={price} onChange={setPrice} placeholder="e.g. 450,000" />
            </div>
          )}

          {purpose !== "sale" && purpose !== "shortlet" && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Price period</label>
              <select value={pricePeriod} onChange={(e) => setPricePeriod(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                {["per year", "per month", "per week", "per day"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-600">Bedrooms</label>
              <input type="number" min={0} value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value === "" ? "" : parseInt(e.target.value))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Bathrooms</label>
              <input type="number" min={0} value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value === "" ? "" : parseInt(e.target.value))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={fenced} onChange={(e) => setFenced(e.target.checked)} /> Fenced
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={gated} onChange={(e) => setGated(e.target.checked)} /> Gated
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Road type</label>
            <select value={roadType} onChange={(e) => setRoadType(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
              {ROAD_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Electricity backup</label>
            <input type="text" value={electricityBackup} onChange={(e) => setElectricityBackup(e.target.value)}
              placeholder="e.g. Generator + inverter" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Water source</label>
            <input type="text" value={waterSource} onChange={(e) => setWaterSource(e.target.value)}
              placeholder="e.g. Borehole" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Photos</label>
            <input type="file" accept="image/*" multiple
              onChange={(e) => setPhotos(e.target.files ? Array.from(e.target.files) : [])}
              className="w-full mt-1 text-xs" />
          </div>

          <div className="border-t border-gray-200 pt-3 mt-2">
            <p className="text-xs font-bold text-chs-charcoal mb-2">Verification documents</p>
            <p className="text-[10px] text-gray-400 mb-2">
              CHS reviews these to verify your listing — upload what applies to your property.
            </p>
            {DOC_TYPES.map((doc) => (
              <div key={doc.value} className="mb-2">
                <label className="text-[11px] text-gray-600">{doc.label}</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) =>
                    setDocuments({ ...documents, [doc.value]: e.target.files?.[0] || null })
                  }
                  className="w-full mt-1 text-xs"
                />
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
            {submitting ? "Creating listing..." : "Submit listing for review"}
          </button>
        </form>
      </div>
    </div>
  );
}
