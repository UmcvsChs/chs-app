"use client";

import { useState } from "react";
import Link from "next/link";
import { MarketplaceProduct, MarketplaceCategory } from "@/types/marketplace";
import { formatNaira } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const CATEGORY_TABS: { value: MarketplaceCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "interior_design", label: "Interior Design" },
  { value: "furniture", label: "Furniture" },
  { value: "bedding_textiles", label: "Bedding & Textiles" },
  { value: "home_equipment", label: "Home Equipment" },
  { value: "building_materials", label: "Building Materials" },
  { value: "security_services", label: "Security" },
  { value: "cleaning_services", label: "Cleaning" },
  { value: "fumigation_pest_control", label: "Fumigation & Pest Control" },
  { value: "facilities_maintenance", label: "Facilities Maintenance" },
];

export default function MarketplaceClient({ products }: { products: MarketplaceProduct[] }) {
  const { session } = useAuth();
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory | "all">("all");
  const [quoteFormFor, setQuoteFormFor] = useState<string | null>(null);
  const [propertyDetails, setPropertyDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedFor, setSubmittedFor] = useState<string | null>(null);

  const filtered =
    activeCategory === "all" ? products : products.filter((p) => p.category === activeCategory);

  async function handleRequestQuote(productId: string) {
    if (!propertyDetails.trim()) {
      setError("Please describe your property and what you need.");
      return;
    }
    if (!session) {
      setError("Please log in first to request a quote.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from("service_quote_requests").insert({
      product_id: productId,
      requester_id: session.user.id,
      property_details: propertyDetails.trim(),
    });

    if (insertError) {
      setError("Could not submit this request. Please try again.");
      setSubmitting(false);
      return;
    }

    setSubmittedFor(productId);
    setSubmitting(false);
    setPropertyDetails("");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-chs-steel-blue via-chs-charcoal to-chs-amber text-white px-4 py-5 flex justify-between items-start">
        <div>
          <h1 className="font-serif text-xl font-bold">CHS Marketplace</h1>
          <p className="text-xs text-white/70">Products and services for your property</p>
        </div>
        <Link href="/become-vendor" className="bg-white/15 text-[10px] font-semibold px-3 py-1.5 rounded-full">
          Sell here →
        </Link>
      </div>

      <nav className="flex gap-2 overflow-x-auto px-4 py-3 bg-white border-b border-gray-100">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveCategory(tab.value)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === tab.value ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="px-4 py-4 grid grid-cols-2 gap-3">
        {filtered.length === 0 ? (
          <p className="col-span-full text-center text-sm text-gray-400 py-12">
            No listings found for this category yet.
          </p>
        ) : (
          filtered.map((product) => (
            <div key={product.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="h-28 bg-chs-steel-blue-light flex items-center justify-center">
                {product.photos && product.photos.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.photos[0]} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-chs-steel-blue text-xs">No photo</span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-chs-charcoal leading-tight">{product.name}</p>

                {product.listing_type === "service" ? (
                  <>
                    {submittedFor === product.id ? (
                      <p className="text-[10px] text-chs-red font-semibold mt-1.5">✓ Quote requested</p>
                    ) : quoteFormFor === product.id ? (
                      <div className="mt-1.5 space-y-1">
                        <textarea
                          value={propertyDetails}
                          onChange={(e) => setPropertyDetails(e.target.value)}
                          rows={2}
                          placeholder="Describe your property and needs"
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[10px]"
                        />
                        {error && <p className="text-[9px] text-chs-red">{error}</p>}
                        <button
                          onClick={() => handleRequestQuote(product.id)}
                          disabled={submitting}
                          className="w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold disabled:opacity-50"
                        >
                          {submitting ? "Sending..." : "Send request"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setQuoteFormFor(product.id); setError(null); }}
                        className="mt-1.5 w-full py-1.5 rounded-full bg-chs-charcoal text-white text-[10px] font-semibold"
                      >
                        Request a quote
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-bold text-chs-charcoal mt-1">
                    {formatNaira(product.price!)}
                    {product.price_unit ? (
                      <span className="font-normal text-[10px] text-gray-500"> {product.price_unit}</span>
                    ) : null}
                  </p>
                )}

                {product.status === "sold_out" && (
                  <span className="inline-block mt-1 text-[9px] font-bold uppercase text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    Sold out
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
