"use client";

import { useEffect, useState } from "react";
import { termsAcceptanceRequired } from "@/lib/termsVersion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import VendorListingForm from "@/components/VendorListingForm";
import { categoryKind, categoryLabel, KIND_LABEL } from "@/lib/marketplaceCategories";
import { MarketplaceVendor, MarketplaceProduct } from "@/types/marketplace";
import { ServiceQuoteRequest } from "@/types/serviceQuoteRequest";
import InfoTip from "@/components/InfoTip";
import { MarketplaceBundle } from "@/types/marketplaceBundle";
import GuidePrompt from "@/components/GuidePrompt";
import { formatNaira } from "@/lib/format";

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
  const [actionError, setActionError] = useState<string | null>(null);


  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    if (profile && termsAcceptanceRequired(profile)) {
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

  // Stock drives "sold out" by itself (a database rule): at 0 the listing is marked sold out, and it reopens when restocked.
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  async function saveStock(productId: string) {
    const raw = stockEdits[productId];
    const n = parseInt(raw, 10);
    if (raw === undefined || raw === "" || !Number.isInteger(n) || n < 0) { setActionError("Please enter the number in stock (0 or more)."); return; }
    setActionError(null);
    const { error: stockError } = await supabase.from("marketplace_products").update({ stock_quantity: n }).eq("id", productId);
    if (stockError) { setActionError("Could not update the stock. Please try again."); return; }
    setStockEdits((e) => { const next = { ...e }; delete next[productId]; return next; });
    loadData();
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
        <p className="text-sm text-gray-500 mb-4">You&apos;re not registered on the Marketplace yet.</p>
        <Link href="/choose-category" className="text-sm font-semibold text-white bg-chs-red px-5 py-2.5 rounded-full">
          Register as a Vendor or Service Provider
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen zone-market-browse bg-[var(--zone-bg)] pb-10">
      <div className="bg-[var(--zone-accent)] text-white px-4 py-4">
        <button onClick={() => router.back()} className="text-xs text-white/70">← Back</button>
        <div className="flex justify-between items-center mt-1">
          <div>
            <h1 className="font-serif text-lg font-bold">{vendor.business_name}</h1>
            <p className="text-[10px] text-white/70">{KIND_LABEL[categoryKind(vendor.category)]} · {categoryLabel(vendor.category)}</p>
          </div>
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
            CHS is reviewing your {KIND_LABEL[categoryKind(vendor.category)].toLowerCase()} registration — your listings won&apos;t be publicly visible until you&apos;re verified, but you can add them now.
          </div>
        )}

        {actionError && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mb-4">{actionError}</p>}

        {directOrders.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-chs-charcoal mb-1.5">🛒 Real Direct Orders (no negotiation)<InfoTip text="A real buyer paid your listed price immediately — no back-and-forth quote request. Funds are held safely until you confirm delivery." /></p>
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

        {showForm && session && (
          <VendorListingForm vendor={vendor} userId={session.user.id} onAdded={() => { setShowForm(false); loadData(); }} />
        )}

        <p className="text-xs font-bold text-chs-charcoal mb-2">My listings ({products.length})<InfoTip term="listing_products_bundles" /></p>
        {products.length === 0 ? (
          <p className="text-sm text-gray-400">No listings added yet.</p>
        ) : (
          products.map((p) => (
            <div key={p.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3 mb-2">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-chs-charcoal">{p.name}</p>
                  {(p.brand || p.model) && <p className="text-[10px] text-gray-500">{[p.brand, p.model].filter(Boolean).join(" · ")}</p>}
                  <p className="text-xs text-gray-500">
                    {p.listing_type === "service" ? "Quote-based service" : `${formatNaira(p.price!)} ${p.price_unit}`}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                  p.status === "sold_out" ? "bg-gray-200 text-gray-600" : p.status === "delisted" ? "bg-red-50 text-chs-red" : "bg-green-50 text-green-700"
                }`}>
                  {p.status === "sold_out" ? "● Sold out" : p.status === "delisted" ? "● Removed" : "● Active"}
                </span>
              </div>
              {p.listing_type === "product" && (
                <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                  <span>In stock:</span>
                  <input type="number" min="0" value={stockEdits[p.id] ?? (p.stock_quantity ?? "")} placeholder="not tracked"
                    onChange={(e) => setStockEdits({ ...stockEdits, [p.id]: e.target.value })}
                    className="w-16 px-2 py-1 rounded border border-gray-200 text-xs" />
                  {stockEdits[p.id] !== undefined && <button onClick={() => saveStock(p.id)} className="font-semibold text-white bg-chs-charcoal px-2.5 py-1 rounded-full">Save</button>}
                  {(p.stock_quantity ?? 1) > 0 && p.status !== "delisted" && (
                    <button onClick={() => toggleSoldOut(p.id, p.status)} className="ml-auto font-semibold underline">
                      {p.status === "sold_out" ? "Reopen listing" : "Mark as sold out"}
                    </button>
                  )}
                </div>
              )}

              {p.listing_type === "service" && p.quoteRequests.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Quote requests ({p.quoteRequests.length})<InfoTip term="service_quote_requests" />
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

      {categoryKind(vendor.category) === "vendor" && (
        <div className="px-4 pb-4">
          <p className="text-xs font-bold text-chs-charcoal mb-2">My Bundles ({bundles.length})<InfoTip text="A real group of your individual products sold together at one combined price — genuinely useful for encouraging a buyer to purchase more at once." /></p>
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
          <span className="text-[9px] text-gray-400">Why no contact info?<InfoTip term="marketplace_admin_mediated_contact_filtered_messaging" /></span>
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
