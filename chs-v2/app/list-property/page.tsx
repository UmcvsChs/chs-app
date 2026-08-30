"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { uploadPropertyPhoto, uploadDocument } from "@/lib/storage";
import CurrencyInput from "@/components/CurrencyInput";

import { LGA_BY_STATE, NIGERIAN_STATES } from "@/lib/geoData";

import { PROPERTY_TYPE_CATEGORIES } from "@/types/propertyTypes";

const DOC_TYPES = [
  { value: "ownership_document", label: "Ownership document" },
  { value: "kadgis", label: "KADGIS approval" },
  { value: "kasupda", label: "KASUPDA approval" },
  { value: "owner_id", label: "Owner's valid ID" },
  { value: "inheritance_consent", label: "Inheritance consent (if applicable)" },
];

const PHOTO_SLOTS = [
  { key: "front", label: "Front exterior" },
  { key: "rear", label: "Rear exterior" },
  { key: "side_left", label: "Side view (left)" },
  { key: "side_right", label: "Side view (right)" },
  { key: "compound", label: "Compound / access road" },
  { key: "sitting", label: "Sitting room" },
  { key: "bedroom", label: "Main bedroom" },
  { key: "kitchen", label: "Kitchen" },
  { key: "bathroom", label: "Bathroom" },
  { key: "meter", label: "Meter / water source" },
];

const PURPOSE_OPTIONS = [
  { value: "sale", label: "For Sale" },
  { value: "rent", label: "For Rent" },
  { value: "rent_to_own", label: "Rent to Own / Mortgage" },
  { value: "lease", label: "For Lease" },
  { value: "hire", label: "For Hire" },
  { value: "shortlet", label: "Shortlet" },
];
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
  const [hireCategory, setHireCategory] = useState("shortlet");
  const [rentToOwnMonthly, setRentToOwnMonthly] = useState<number | "">("");
  const [rentToOwnYears, setRentToOwnYears] = useState<number | "">(5);
  const [rentToOwnPortionPct, setRentToOwnPortionPct] = useState<number | "">(100);
  // Real, sale-specific fields — restored, found completely missing
  // during the systematic property listing form comparison.
  const [minAcceptable, setMinAcceptable] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("outright_only");
  const [depositPct, setDepositPct] = useState("");
  const [balanceDeadline, setBalanceDeadline] = useState("");
  const [ownershipDeclared, setOwnershipDeclared] = useState(false);
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPE_CATEGORIES[0].options[0]);
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
  // Real, labeled photo slots — restored, found missing during the
  // systematic property listing form comparison. The original's real
  // rationale: specific, guided photos genuinely reduce wasted
  // inspection trips, since buyers arrive already knowing what to
  // expect, rather than a generic unlabeled photo dump.
  const [labeledPhotos, setLabeledPhotos] = useState<Record<string, File | null>>({});
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<Record<string, File | null>>({});
  const [saleDocuments, setSaleDocuments] = useState<Record<string, File | null>>({});
  // Real ownership context fields — restored, found missing during
  // the systematic property listing form comparison. Genuinely useful
  // structured context for CHS's real verification team, not just a
  // raw file with no classification.
  const [acquisitionMethod, setAcquisitionMethod] = useState("Personal purchase");
  const [primaryDocType, setPrimaryDocType] = useState("Certificate of Occupancy (C of O)");

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
    // A real, required legal gate — restored, found completely missing.
    // The original never let a sale listing be submitted without this.
    if (purpose === "sale" && !ownershipDeclared) {
      return "Please confirm the ownership declaration before submitting a sale listing.";
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
        // The real category that decides which real commission tier
        // applies — a genuine Shortlet gets the length-of-stay sliding
        // scale, everything else in this bucket gets the flat rate.
        hire_category: purpose === "shortlet" ? hireCategory : null,
        rent_to_own_monthly: purpose === "rent_to_own" ? rentToOwnMonthly : null,
        rent_to_own_years: purpose === "rent_to_own" ? rentToOwnYears : null,
        rent_to_own_portion_pct: purpose === "rent_to_own" ? rentToOwnPortionPct : null,
        rent_to_own_available: purpose === "rent_to_own",
        min_acceptable_amount: purpose === "sale" && minAcceptable ? parseInt(minAcceptable.replace(/\D/g, ""), 10) : null,
        payment_terms: purpose === "sale" ? paymentTerms : null,
        deposit_percentage: purpose === "sale" ? depositPct.trim() || null : null,
        balance_payment_deadline: purpose === "sale" ? balanceDeadline.trim() || null : null,
        ownership_declared: purpose === "sale" ? ownershipDeclared : false,
        acquisition_method: acquisitionMethod,
        primary_document_type: primaryDocType,
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
    // organise them under. Labeled slots upload first, so the front
    // exterior genuinely becomes the main display photo, followed by
    // any additional unlabeled photos.
    const allPhotos = [...PHOTO_SLOTS.map((s) => labeledPhotos[s.key]).filter((f): f is File => !!f), ...photos];
    if (allPhotos.length > 0) {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < allPhotos.length; i++) {
        const url = await uploadPropertyPhoto(allPhotos[i], session.user.id, newProperty.id, i);
        if (url) uploadedUrls.push(url);
      }
      if (uploadedUrls.length > 0) {
        await supabase.from("properties").update({ photos: uploadedUrls }).eq("id", newProperty.id);
      }

      // A real, genuine gap the client specifically flagged: the
      // database already had a place to store a video link, but the
      // actual form never gave anyone a way to add one.
      if (videoFile) {
        const videoUrl = await uploadDocument(videoFile, session.user.id, `property-${newProperty.id}-video`);
        if (videoUrl) {
          await supabase.from("properties").update({ video_url: videoUrl }).eq("id", newProperty.id);
        }
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

    // Real, sourced legal requirement for a Sale listing specifically
    // — Certificate of Occupancy, Deed of Assignment, Survey Plan,
    // Governor's Consent, Tax Clearance, and Sale Agreement, matching
    // actual Nigerian real estate transaction practice. Uploaded here
    // as soft copies for CHS to genuinely verify; a buyer's payment
    // cannot proceed until every one of these is confirmed.
    if (purpose === "sale") {
      for (const [docType, file] of Object.entries(saleDocuments)) {
        if (!file) continue;
        const url = await uploadDocument(file, session.user.id, `sale-doc-${docType}`);
        if (url) {
          await supabase.from("property_sale_documents").insert({
            property_id: newProperty.id,
            document_type: docType,
            file_url: url,
          });
        }
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
    <div className="min-h-screen zone-owner bg-[var(--zone-bg)] px-4 py-8">
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
              {PROPERTY_TYPE_CATEGORIES.map((cat) => (
                <optgroup key={cat.label} label={`${cat.icon} ${cat.label}`}>
                  {cat.options.map((t) => <option key={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">State</label>
            <select
              value={locationState}
              onChange={(e) => { setLocationState(e.target.value); setLocationLga(""); }}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
            >
              {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">LGA</label>
            <select
              value={locationLga}
              onChange={(e) => setLocationLga(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white"
            >
              <option value="">Select an LGA</option>
              {(LGA_BY_STATE[locationState] || []).map((lga) => <option key={lga}>{lga}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Location area</label>
            <input type="text" value={locationArea} onChange={(e) => setLocationArea(e.target.value)}
              placeholder="e.g. Malali GRA" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
          </div>

          {purpose === "shortlet" ? (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-600">Price per night (₦)</label>
                <CurrencyInput value={pricePerNight} onChange={setPricePerNight} placeholder="e.g. 45,000" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">What kind of short-term stay is this?</label>
                <p className="text-[10px] text-gray-400 mb-1">This decides the real commission rate applied to bookings.</p>
                <select value={hireCategory} onChange={(e) => setHireCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="shortlet">Shortlet apartment/house (rate scales with length of stay)</option>
                  <option value="hotel_lodge">Hotel or lodge room (flat rate per night)</option>
                  <option value="event_centre">Event centre (flat rate per booking)</option>
                  <option value="car_park_casual">Casual/hourly car park (flat rate per booking)</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="text-xs font-semibold text-gray-600">Price (₦)</label>
              <CurrencyInput value={price} onChange={setPrice} placeholder="e.g. 450,000" />
            </div>
          )}

          {purpose === "rent_to_own" && (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-600">Real monthly installment (₦)</label>
                <CurrencyInput value={rentToOwnMonthly} onChange={setRentToOwnMonthly} placeholder="e.g. 150,000" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Real term (years)</label>
                <input type="number" min={1} max={30} value={rentToOwnYears}
                  onChange={(e) => setRentToOwnYears(e.target.value ? Number(e.target.value) : "")}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Portion of each payment counting toward ownership (%)</label>
                <p className="text-[10px] text-gray-400 mb-1">Use 100% if the full payment builds toward ownership. Lower this only if part of each installment is a genuine, separate service/maintenance charge.</p>
                <input type="number" min={1} max={100} value={rentToOwnPortionPct}
                  onChange={(e) => setRentToOwnPortionPct(e.target.value ? Number(e.target.value) : "")}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
            </>
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

          {/* Real sale-specific fields — restored, found completely
              missing during the systematic property listing form
              comparison. The ownership declaration specifically is a
              real legal protection, not a formality — the original
              never allowed a sale listing to be submitted without it. */}
          {purpose === "sale" && (
            <div className="space-y-3 border-t border-gray-200 pt-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Lowest acceptable amount (₦) — for owner reference, not shown publicly</label>
                <input type="text" value={minAcceptable} onChange={(e) => setMinAcceptable(e.target.value)}
                  placeholder="e.g. 43,000,000" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Terms of payment</label>
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="outright_only">Outright payment only</option>
                  <option value="instalment_allowed">Instalment allowed</option>
                  <option value="both">Both outright and instalment accepted</option>
                </select>
              </div>
              {paymentTerms !== "outright_only" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">If instalment — deposit percentage required</label>
                    <input type="text" value={depositPct} onChange={(e) => setDepositPct(e.target.value)}
                      placeholder="e.g. 30% down payment" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Balance payment deadline</label>
                    <input type="text" value={balanceDeadline} onChange={(e) => setBalanceDeadline(e.target.value)}
                      placeholder="e.g. Balance due within 60 days of deposit" className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                  </div>
                  <p className="text-[10px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    If the balance is not paid by the deadline, the offer is forfeited to the next highest bidder and the deposit is refunded per CHS policy.
                  </p>
                </>
              )}

              <div className="bg-[var(--zone-card)] rounded-xl p-3 border-2 border-chs-red">
                <p className="text-xs font-bold text-chs-red mb-2">⚖️ Ownership declaration — required</p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={ownershipDeclared} onChange={(e) => setOwnershipDeclared(e.target.checked)} className="mt-0.5 shrink-0" />
                  <span className="text-[11px] text-gray-600 leading-relaxed">
                    I declare that I hold clear and undisputed authority to sell this property. Where it is inherited or family-owned, I confirm that every co-heir or beneficiary with an interest in it has genuinely consented to this sale. I understand that a false declaration makes me personally and solely liable for any resulting dispute, and that CHS may suspend my account and report suspected fraud to the appropriate authorities.
                  </span>
                </label>
              </div>
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
            <p className="text-[10px] text-gray-400 mb-1.5">
              Specific, labeled photos genuinely reduce wasted inspection trips — buyers arrive already knowing what to expect.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {PHOTO_SLOTS.map((slot) => (
                <div key={slot.key}>
                  <label className="text-[10px] text-gray-500">{slot.label}</label>
                  <input type="file" accept="image/*"
                    onChange={(e) => setLabeledPhotos({ ...labeledPhotos, [slot.key]: e.target.files?.[0] || null })}
                    className="w-full mt-0.5 text-[10px]" />
                </div>
              ))}
            </div>
            <label className="text-xs font-semibold text-gray-600">Additional photos (optional)</label>
            <input type="file" accept="image/*" multiple
              onChange={(e) => setPhotos(e.target.files ? Array.from(e.target.files) : [])}
              className="w-full mt-1 text-xs" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Short video (optional)</label>
            <p className="text-[10px] text-gray-400 mb-1">A brief walkthrough helps buyers and tenants get a real feel for the property.</p>
            <input type="file" accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              className="w-full mt-1 text-xs" />
          </div>

          <div className="border-t border-gray-200 pt-3 mt-2">
            <p className="text-xs font-bold text-chs-charcoal mb-2">Verification documents</p>
            <p className="text-[10px] text-gray-400 mb-2">
              CHS reviews these to verify your listing — upload what applies to your property.
            </p>

            <div className="mb-2">
              <label className="text-xs font-semibold text-gray-600">How was this property acquired?</label>
              <select value={acquisitionMethod} onChange={(e) => setAcquisitionMethod(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                {["Personal purchase", "Inheritance / family property", "Gift / donation", "Government allocation", "Court judgment / settlement", "Business/company asset"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="text-xs font-semibold text-gray-600">Primary ownership document type</label>
              <select value={primaryDocType} onChange={(e) => setPrimaryDocType(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white">
                {["Certificate of Occupancy (C of O)", "Right of Occupancy (R of O)", "Deed of Assignment", "Survey Plan", "Governor's Consent", "Letter of Administration (inheritance)", "Deed of Gift", "Not yet titled"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
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

            {purpose === "sale" && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-xs font-bold text-chs-charcoal mb-1">Real legal documents required for Sale</p>
                <p className="text-[10px] text-gray-500 mb-2">
                  CHS must genuinely verify every one of these before a buyer&apos;s payment can proceed. Upload real soft copies now — prepare the real hard copies through a barrister for the actual legal transfer once a sale completes.
                </p>
                {[
                  { value: "certificate_of_occupancy", label: "Certificate of Occupancy (C of O)" },
                  { value: "deed_of_assignment", label: "Deed of Assignment" },
                  { value: "survey_plan", label: "Survey Plan (Registered)" },
                  { value: "governors_consent", label: "Governor's Consent" },
                  { value: "tax_clearance_certificate", label: "Tax Clearance Certificate" },
                  { value: "sale_agreement", label: "Sale Agreement" },
                ].map((doc) => (
                  <div key={doc.value} className="mb-2">
                    <label className="text-[11px] text-gray-600">{doc.label} *</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) =>
                        setSaleDocuments({ ...saleDocuments, [doc.value]: e.target.files?.[0] || null })
                      }
                      className="w-full mt-1 text-xs"
                    />
                  </div>
                ))}
                {!propertyType.toLowerCase().includes("land") && !propertyType.toLowerCase().includes("farmland") && (
                  <div className="mb-2">
                    <label className="text-[11px] text-gray-600">Building Plan Approval *</label>
                    <p className="text-[9px] text-gray-400 mb-0.5">Required for a developed property with a real structure on it.</p>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) =>
                        setSaleDocuments({ ...saleDocuments, building_plan_approval: e.target.files?.[0] || null })
                      }
                      className="w-full mt-1 text-xs"
                    />
                  </div>
                )}
              </div>
            )}
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
