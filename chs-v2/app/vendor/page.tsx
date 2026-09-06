"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { uploadPropertyPhoto } from "@/lib/storage";
import { MarketplaceVendor, MarketplaceProduct, ListingType } from "@/types/marketplace";
import { ServiceQuoteRequest } from "@/types/serviceQuoteRequest";
import { BUILDING_MATERIALS_CATALOG, MATERIAL_SECTIONS } from "@/types/buildingMaterials";
import { MarketplaceBundle } from "@/types/marketplaceBundle";
import GuidePrompt from "@/components/GuidePrompt";
import { formatNaira } from "@/lib/format";

const SERVICE_CATEGORIES = [
  "security_services", "cleaning_services", "fumigation_pest_control", "facilities_maintenance",
];

interface ProductWithQuotes extends MarketplaceProduct {
  quoteRequests: ServiceQuoteRequest[];
}

interface DirectOrderRow {
  id: string;
  reference_number: string;
  amount: number;
  vendor_commission_amount: number;
  payment_status: string;
  created_at: string;
  marketplace_products: { name: string }[] | null;
}

export default function VendorDashboard() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [vendor, setVendor] = useState<MarketplaceVendor | null>(null);
  const [products, setProducts] = useState<ProductWithQuotes[]>([]);
  const [bundles, setBundles] = useState<MarketplaceBundle[]>([]);
  const [directOrders, setDirectOrders] = useState<DirectOrderRow[]>([]);
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [bundleName, setBundleName] = useState("");
  const [bundleItems, setBundleItems] = useState("");
  const [bundlePrice, setBundlePrice] = useState<number | "">("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [bundleSubmitting, setBundleSubmitting] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [listingType, setListingType] = useState<ListingType>("product");
  const [price, setPrice] = useState<number | "">("");
  const [priceUnit, setPriceUnit] = useState("per unit");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [materialSection, setMaterialSection] = useState(MATERIAL_SECTIONS[0]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [othersMaterialName, setOthersMaterialName] = useState("");
  const [othersUnit, setOthersUnit] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    if (profile && !profile.terms_accepted_at) {
      router.push("/accept-terms?redirect=/vendor");
      return;
    }
    if (profile && !profile.guide_roles_seen.includes("vendor")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowGuide(true);
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, profile]);

  async function loadData() {
    if (!session) return;
    setLoading(true);

    const { data: vendorData } = await supabase
      .from("marketplace_vendors")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    setVendor(vendorData);

    // A vendor whose real category is a service category should default
    // to listing services — a security firm's own products list is
    // genuinely almost always services, not physical goods. Set here,
    // alongside the vendor data itself, rather than in a separate effect
    // reacting to it a render later.
    if (vendorData && SERVICE_CATEGORIES.includes(vendorData.category)) {
      setListingType("service");
    }

    if (vendorData) {
      const { data: productsData } = await supabase
        .from("marketplace_products")
        .select("*")
        .eq("vendor_id", vendorData.id)
        .order("created_at", { ascending: false });

      const withQuotes = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: quotes } = await supabase
            .from("service_quote_requests")
            .select("*")
            .eq("product_id", product.id)
            .order("created_at", { ascending: false });
          return { ...product, quoteRequests: quotes || [] } as ProductWithQuotes;
        })
      );
      setProducts(withQuotes);

      const { data: bundlesData } = await supabase
        .from("marketplace_bundles")
        .select("*")
        .eq("vendor_id", vendorData.id)
        .order("created_at", { ascending: false });
      setBundles(bundlesData || []);

      // Real, new direct orders — a genuine "skip the conversation"
      // purchase, at the product's own real price, with no quote or
      // negotiation involved at all.
      const productIds = (productsData || []).map((p) => p.id);
      if (productIds.length > 0) {
        const { data: ordersData } = await supabase
          .from("marketplace_direct_orders")
          .select("*, marketplace_products(name)")
          .in("product_id", productIds)
          .order("created_at", { ascending: false });
        setDirectOrders((ordersData as unknown as DirectOrderRow[]) || []);
      }
    }
    setLoading(false);
  }

  const isBuildingMaterials = vendor?.category === "building_materials";
  const currentMaterialEntry = BUILDING_MATERIALS_CATALOG[materialSection]?.find((m) => m.name === selectedMaterial);
  const isOthersMaterial = currentMaterialEntry?.unit === null;

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();

    // For building materials specifically, the real name and unit come
    // from the real, standardised catalog — never free text — since
    // that's what actually makes genuine price comparison between
    // vendors possible in the first place.
    const finalName = isBuildingMaterials
      ? (isOthersMaterial ? othersMaterialName.trim() : selectedMaterial)
      : name.trim();
    const finalUnit = isBuildingMaterials
      ? (isOthersMaterial ? othersUnit.trim() : currentMaterialEntry?.unit || "")
      : priceUnit;

    if (!finalName || !vendor) {
      setError(isBuildingMaterials ? "Please select a material." : "Please enter a name.");
      return;
    }
    // A real product genuinely needs a real price — a service
    // deliberately doesn't, since real pricing depends on the specific
    // property, not a fixed shelf price.
    if (listingType === "product" && !price) {
      setError("Please enter a price for this product.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { data: newProduct, error: insertError } = await supabase
      .from("marketplace_products")
      .insert({
        vendor_id: vendor.id,
        name: finalName,
        category: vendor.category,
        listing_type: listingType,
        price: listingType === "service" ? null : price,
        price_unit: listingType === "service" ? null : finalUnit,
        description: description.trim() || null,
        photos: [],
      })
      .select()
      .single();

    if (insertError || !newProduct) {
      setError("Could not add this listing. Please try again.");
      setSubmitting(false);
      return;
    }

    if (photo && session) {
      const url = await uploadPropertyPhoto(photo, session.user.id, newProduct.id, 0);
      if (url) await supabase.from("marketplace_products").update({ photos: [url] }).eq("id", newProduct.id);
    }

    setName(""); setPrice(""); setDescription(""); setPhoto(null); setShowForm(false);
    loadData();
    setSubmitting(false);
  }

  async function handleCreateBundle(e: React.FormEvent) {
    e.preventDefault();
    if (!bundleName.trim() || !bundleItems.trim() || !bundlePrice || !vendor) {
      setBundleError("Please fill in the bundle name, what's included, and the price.");
      return;
    }
    setBundleError(null);
    setBundleSubmitting(true);

    // Deliberately its own real record, sitting alongside individual
    // products rather than replacing them — matching the original
    // app's own explicit design note, so a buyer comparing prices on a
    // specific material still sees this vendor's individual listing
    // for it too.
    const { error: insertError } = await supabase.from("marketplace_bundles").insert({
      vendor_id: vendor.id,
      bundle_name: bundleName.trim(),
      category: vendor.category,
      items_included: bundleItems.trim(),
      price: bundlePrice,
      description: bundleDescription.trim() || null,
    });

    if (insertError) {
      setBundleError("Could not create this bundle. Please try again.");
      setBundleSubmitting(false);
      return;
    }

    setBundleName(""); setBundleItems(""); setBundlePrice(""); setBundleDescription(""); setShowBundleForm(false);
    loadData();
    setBundleSubmitting(false);
  }

  async function toggleBundleStatus(bundleId: string, currentStatus: string) {
    const newStatus = currentStatus === "delisted" ? "active" : "delisted";
    await supabase.from("marketplace_bundles").update({ status: newStatus }).eq("id", bundleId);
    loadData();
  }

  async function toggleSoldOut(productId: string, currentStatus: string) {
    const newStatus = currentStatus === "sold_out" ? "active" : "sold_out";
    await supabase.from("marketplace_products").update({ status: newStatus }).eq("id", productId);
    loadData();
  }

  // Real, direct fix per explicit client instruction: a vendor's
  // response is now genuinely filtered for contact information and
  // held for real CHS review before the buyer ever sees it — no more
  // direct, unmoderated delivery.
  async function handleRespondToQuote(quoteId: string, response: string, amount: number | null) {
    if (!response.trim() || amount === null) return;
    setActionError(null);
    const { error } = await supabase.rpc("submit_vendor_quote_response", {
      p_request_id: quoteId,
      p_response: response.trim(),
      p_quoted_amount: amount,
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    loadData();
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }

  if (!vendor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500 mb-4">You&apos;re not registered as a Marketplace vendor yet.</p>
        <Link href="/become-vendor" className="text-sm font-semibold text-white bg-chs-red px-5 py-2.5 rounded-full">
          Register as a vendor
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen zone-market-browse bg-[var(--zone-bg)] pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <button onClick={() => router.back()} className="text-xs text-white/70">← Back</button>
        <div className="flex justify-between items-center mt-1">
          <h1 className="font-serif text-lg font-bold">{vendor.business_name}</h1>
          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
            vendor.verification_status === "verified" ? "bg-chs-red" : "bg-white/15"
          }`}>
            {vendor.verification_status === "verified" ? "✓ Verified" : "Pending review"}
          </span>
        </div>
      </div>

      <div className="px-4 py-4">
        {vendor.verification_status !== "verified" && (
          <div className="bg-chs-amber-light text-chs-amber-dark text-xs font-semibold px-3 py-2 rounded-lg mb-4">
            CHS is reviewing your vendor registration — your listings won&apos;t be publicly visible until you&apos;re verified, but you can add them now.
          </div>
        )}

        {actionError && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mb-4">{actionError}</p>}

        {directOrders.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-chs-charcoal mb-1.5">🛒 Real Direct Orders (no negotiation)</p>
            {directOrders.map((o) => (
              <div key={o.id} className="bg-[var(--zone-card)] rounded-lg p-2.5 mb-1.5 text-xs">
                <div className="flex justify-between items-start">
                  <p className="text-gray-700">{o.marketplace_products?.[0]?.name}</p>
                  <span className="text-[9px] font-bold text-white bg-chs-charcoal px-1.5 py-0.5 rounded-full">{o.reference_number}</span>
                </div>
                <p className="font-semibold text-chs-charcoal mt-0.5">{formatNaira(o.amount)}</p>
                {o.payment_status === "held_escrow" && <p className="text-[10px] text-green-700 font-semibold mt-1">💰 Paid — held in escrow, pending CHS confirmation of delivery.</p>}
                {o.payment_status === "released" && <p className="text-[10px] text-green-700 font-semibold mt-1">✓ Paid out, net of your real commission.</p>}
                {o.payment_status === "refunded" && <p className="text-[10px] text-gray-500 font-semibold mt-1">↩ Refunded to the buyer.</p>}
              </div>
            ))}
          </div>
        )}

        <button onClick={() => setShowForm(!showForm)}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold mb-4">
          {showForm ? "Cancel" : "+ Add a listing"}
        </button>

        {showForm && (
          <form onSubmit={handleAddProduct} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 mb-4 space-y-2">
            <div className="flex gap-2 mb-1">
              <button type="button" onClick={() => setListingType("product")}
                className={`flex-1 py-2 rounded-lg border-2 text-xs font-semibold ${listingType === "product" ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>
                Product (fixed price)
              </button>
              <button type="button" onClick={() => setListingType("service")}
                className={`flex-1 py-2 rounded-lg border-2 text-xs font-semibold ${listingType === "service" ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>
                Service (quote-based)
              </button>
            </div>
            {isBuildingMaterials ? (
              <>
                <select value={materialSection} onChange={(e) => { setMaterialSection(e.target.value); setSelectedMaterial(""); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                  {MATERIAL_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={selectedMaterial} onChange={(e) => setSelectedMaterial(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="">Select a material...</option>
                  {(BUILDING_MATERIALS_CATALOG[materialSection] || []).map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
                {isOthersMaterial && (
                  <>
                    <input type="text" value={othersMaterialName} onChange={(e) => setOthersMaterialName(e.target.value)}
                      placeholder="Material name" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                    <input type="text" value={othersUnit} onChange={(e) => setOthersUnit(e.target.value)}
                      placeholder="Pricing unit (e.g. per tonne)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                  </>
                )}
                {selectedMaterial && !isOthersMaterial && (
                  <p className="text-[10px] text-gray-400">
                    Real, standardised unit for this material: <span className="font-semibold">{currentMaterialEntry?.unit}</span> — locked, so every vendor&apos;s price is genuinely comparable.
                  </p>
                )}
              </>
            ) : (
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={listingType === "service" ? "Service name (e.g. Estate Security Package)" : "Product name"}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            )}
            {listingType === "product" ? (
              <div className="flex gap-2">
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : parseInt(e.target.value))}
                  placeholder="Price (₦)" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                {!isBuildingMaterials && (
                  <select value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)}
                    className="px-2 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                    {["per unit", "per bag", "per sqm", "per project"].map((u) => <option key={u}>{u}</option>)}
                  </select>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-gray-400">
                Real estate owners will request a real quote for this — pricing depends on the specific property, so no fixed price is needed here.
              </p>
            )}
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Description" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="w-full text-xs" />
            {error && <p className="text-xs text-chs-red">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">
              {submitting ? "Adding..." : "Add listing"}
            </button>
          </form>
        )}

        <p className="text-xs font-bold text-chs-charcoal mb-2">My listings ({products.length})</p>
        {products.length === 0 ? (
          <p className="text-sm text-gray-400">No listings added yet.</p>
        ) : (
          products.map((p) => (
            <div key={p.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-chs-charcoal">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {p.listing_type === "service" ? "Quote-based service" : `${formatNaira(p.price!)} ${p.price_unit}`}
                  </p>
                </div>
                <button onClick={() => toggleSoldOut(p.id, p.status)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                    p.status === "sold_out" ? "bg-gray-100 text-gray-500" : "bg-chs-amber-light text-chs-amber-dark"
                  }`}>
                  {p.status === "sold_out" ? "Mark active" : "Mark sold out"}
                </button>
              </div>

              {p.listing_type === "service" && p.quoteRequests.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Quote requests ({p.quoteRequests.length})
                  </p>
                  {p.quoteRequests.map((q) => (
                    <QuoteRequestRow key={q.id} quote={q} onRespond={handleRespondToQuote} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {!SERVICE_CATEGORIES.includes(vendor.category) && (
        <div className="px-4 pb-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">My Bundles ({bundles.length})</p>
          <p className="text-[10px] text-gray-400 mb-2">
            Bundles sit alongside your individual listings, not instead of them — buyers comparing prices on a specific item still see your individual listing for it.
          </p>

          <button onClick={() => setShowBundleForm(!showBundleForm)}
            className="w-full py-2.5 rounded-full bg-chs-charcoal text-white text-xs font-semibold mb-3">
            {showBundleForm ? "Cancel" : "📦 Create a Bundle"}
          </button>

          {showBundleForm && (
            <form onSubmit={handleCreateBundle} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 mb-3 space-y-2">
              <input type="text" value={bundleName} onChange={(e) => setBundleName(e.target.value)}
                placeholder="Bundle name (e.g. Foundation Materials Starter Package)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <textarea value={bundleItems} onChange={(e) => setBundleItems(e.target.value)} rows={3}
                placeholder="What's included (e.g. 50 bags cement, 3 trips sharp sand, 500 blocks)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <input type="number" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value === "" ? "" : parseInt(e.target.value))}
                placeholder="Bundle price (₦)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <textarea value={bundleDescription} onChange={(e) => setBundleDescription(e.target.value)} rows={2}
                placeholder="Description (optional) — delivery terms, suitable project size, etc."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              {bundleError && <p className="text-xs text-chs-red">{bundleError}</p>}
              <button type="submit" disabled={bundleSubmitting}
                className="w-full py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
                {bundleSubmitting ? "Creating..." : "Create bundle"}
              </button>
            </form>
          )}

          {bundles.length === 0 ? (
            <p className="text-sm text-gray-400">No bundles created yet.</p>
          ) : (
            bundles.map((b) => (
              <div key={b.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-chs-charcoal">{b.bundle_name}</p>
                  <button onClick={() => toggleBundleStatus(b.id, b.status)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                      b.status === "delisted" ? "bg-gray-100 text-gray-500" : "bg-chs-amber-light text-chs-amber-dark"
                    }`}>
                    {b.status === "delisted" ? "Relist" : "Delist"}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">{b.items_included}</p>
                <p className="text-xs font-bold text-chs-charcoal mt-1">{formatNaira(b.price)}</p>
              </div>
            ))
          )}
        </div>
      )}
      {showGuide && <GuidePrompt role="vendor" onDismiss={() => setShowGuide(false)} />}
    </div>
  );
}

function QuoteRequestRow({
  quote,
  onRespond,
}: {
  quote: ServiceQuoteRequest;
  onRespond: (quoteId: string, response: string, amount: number | null) => void;
}) {
  const [response, setResponse] = useState(quote.vendor_response || "");
  const [amount, setAmount] = useState<number | "">(quote.quoted_amount || "");

  // Real, direct fix: a vendor never sees the buyer's real name here —
  // only the real, permanent CHS reference number identifies them,
  // exactly as instructed.
  if (quote.moderation_status !== "approved") {
    return (
      <div className="bg-gray-50 rounded-lg p-2.5 mb-1.5 text-xs">
        <p className="text-[9px] font-bold text-gray-400 uppercase">{quote.reference_number}</p>
        <p className="text-gray-400 italic mt-1">⏳ Awaiting real CHS review before you can see or respond to this request.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-2.5 mb-1.5 text-xs">
      <p className="text-[9px] font-bold text-gray-400 uppercase">{quote.reference_number}</p>
      <p className="text-gray-700 mt-1">{quote.property_details}</p>

      {!quote.vendor_response ? (
        <div className="mt-2 space-y-1.5">
          <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={2}
            placeholder="Your response — no phone numbers or emails" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : parseInt(e.target.value))}
            placeholder="Real quoted amount (₦)" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs" />
          <button onClick={() => onRespond(quote.id, response, amount || null)}
            className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
            Send to CHS for review
          </button>
        </div>
      ) : (
        <div className="mt-1.5">
          <p className="text-gray-600">{quote.vendor_response}</p>
          {quote.quoted_amount && <p className="font-semibold text-chs-charcoal mt-0.5">{formatNaira(quote.quoted_amount)}</p>}
          {quote.response_moderation_status === "pending_review" && (
            <p className="text-[10px] text-gray-400 italic mt-1">⏳ Awaiting real CHS review before the buyer sees this.</p>
          )}
          {quote.response_moderation_status === "blocked" && (
            <p className="text-[10px] text-chs-red mt-1">🚫 Not approved — {quote.response_block_reason}</p>
          )}
          {quote.response_moderation_status === "approved" && quote.payment_status === "unpaid" && (
            <p className="text-[10px] text-gray-400 italic mt-1">✓ Delivered — awaiting the buyer&apos;s real payment.</p>
          )}
          {quote.payment_status === "held_escrow" && (
            <p className="text-[10px] text-green-700 font-semibold mt-1">💰 Real payment held in escrow — CHS will release it once delivery is confirmed.</p>
          )}
          {quote.payment_status === "released" && (
            <p className="text-[10px] text-green-700 font-semibold mt-1">✓ Paid out — net of your real commission.</p>
          )}
          {quote.payment_status === "refunded" && (
            <p className="text-[10px] text-gray-500 font-semibold mt-1">↩ This deal was refunded to the buyer.</p>
          )}
        </div>
      )}
    </div>
  );
}
