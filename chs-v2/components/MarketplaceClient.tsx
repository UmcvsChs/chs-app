"use client";

import { VENDOR_CATEGORIES, SERVICE_CATEGORIES } from "@/lib/marketplaceCategories";
import ProductDetailSheet from "@/components/ProductDetailSheet";
import { Fragment, useState, useEffect, useRef } from "react";
import Link from "next/link";
import RefundPolicyNotice from "./RefundPolicyNotice";
import { MarketplaceProduct, MarketplaceCategory } from "@/types/marketplace";
import { MarketplaceBundle } from "@/types/marketplaceBundle";
import { formatNaira } from "@/lib/format";
import InfoTip from "./InfoTip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import IdentityVerificationGate from "./IdentityVerificationGate";
import MarketplaceCart from "./MarketplaceCart";
import { useCart } from "@/lib/cart";
import { useDeliveryCity, type DeliveryHint } from "@/lib/delivery";
import DeliveryCityPicker from "./DeliveryCityPicker";
import DeliveryBadge from "./DeliveryBadge";
import SearchScopeGuide, { SCOPES, useScopeGuide, type Scope } from "./SearchScopeGuide";

const CATEGORY_TABS: { value: MarketplaceCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...VENDOR_CATEGORIES.map((c) => ({ value: c.value, label: c.short })),
  ...SERVICE_CATEGORIES.map((c) => ({ value: c.value, label: c.short })),
];

export default function MarketplaceClient({ products, bundles }: { products: MarketplaceProduct[]; bundles: MarketplaceBundle[] }) {
  const [view, setView] = useState<"items" | "bundles">("items");
  const { session } = useAuth();
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory | "all">("all");
  const [quoteFormFor, setQuoteFormFor] = useState<string | null>(null);
  const [propertyDetails, setPropertyDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedFor, setSubmittedFor] = useState<string | null>(null);

  const [scope, setScope] = useState<Scope>("near");
  const guide = useScopeGuide();
  const cart = useCart(session?.user.id);
  const [cartOpen, setCartOpen] = useState(false);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const dcity = useDeliveryCity(session?.user.id);
  const [hints, setHints] = useState<Record<string, DeliveryHint>>({});
  useEffect(() => {
    const ids = products.filter((p) => p.listing_type === "product").map((p) => p.id);
    if (!dcity.cityId || ids.length === 0) { // eslint-disable-next-line react-hooks/set-state-in-effect
      setHints({}); return; }
    supabase.rpc("get_product_delivery_hints", { p_product_ids: ids, p_city_id: dcity.cityId }).then(({ data }) => {
      const m: Record<string, DeliveryHint> = {};
      for (const h of (data as DeliveryHint[]) || []) m[h.product_id] = h;
      setHints(m);
    });
  }, [dcity.cityId, products]);
  const hintCount = Object.keys(hints).length;
  const nearbyCount = Object.values(hints).filter((h) => h.nearby).length;

  // Buying, and asking for a quote, are commitments — they now sit
  // behind the same one-time identity verification as every other
  // commitment on the platform. Browsing stays completely free: the
  // verification step only appears at the moment an unverified person
  // actually tries to buy or request a quote.
  const [identityVerified, setIdentityVerified] = useState<boolean | null>(null);
  const [showGate, setShowGate] = useState(false);
  const gateRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!session) return;
    supabase.from("profiles").select("valid_id_verified").eq("id", session.user.id).single()
      .then(({ data }) => setIdentityVerified(!!data?.valid_id_verified));
  }, [session]);
  useEffect(() => {
    if (showGate && gateRef.current) gateRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showGate]);
  function requireVerified(): boolean {
    if (identityVerified) return true;
    setShowGate(true);
    setError("Before you can buy or request a quote, CHS needs to verify your identity once. Please complete the step at the top of the page.");
    return false;
  }

  // Real, new feature per direct client request: a genuine, admin-
  // editable link to CHS's sister buying-and-selling platform, for
  // procurement CHS's own marketplace doesn't yet cover (automobiles,
  // consumables, and more) — still real, verified sellers, still
  // under CHS's own jurisdiction.
  const [sisterLink, setSisterLink] = useState<{ sister_marketplace_name: string; sister_marketplace_url: string } | null>(null);
  useEffect(() => {
    supabase.rpc("get_sister_marketplace_link").then(({ data }) => setSisterLink(data));
  }, []);

  // landed cost = price + the estimated delivery to the buyer's city; items with no hint (services, or no city chosen) are never hidden
  const landed = (p: MarketplaceProduct) => (p.price ?? Infinity) + (hints[p.id]?.est_fee ?? 0);
  const inCategory = activeCategory === "all" ? products : products.filter((p) => p.category === activeCategory);
  const hasCity = !!dcity.cityId && hintCount > 0;
  const scoped = hasCity && scope === "near" ? inCategory.filter((p) => !hints[p.id] || hints[p.id].nearby) : inCategory;
  const hiddenFar = inCategory.length - scoped.length;
  const filtered = scoped.slice().sort((a, b) => {
    if (!hasCity) return scope === "cheapest" ? (a.price ?? Infinity) - (b.price ?? Infinity) : 0;
    if (scope === "cheapest") return landed(a) - landed(b);
    return (hints[a.id]?.km ?? 99999) - (hints[b.id]?.km ?? 99999);
  });

  // Shopping works like any marketplace: add items (with options and quantity) to a cart that is kept on this device,
  // then check out once, with one delivery address, paying from the CHS wallet (topped up on the spot if needed).
  // The money is held by CHS until delivery is confirmed.
  function handleAddToCart(productId: string, quantity: number, options: Record<string, string>, goToCart: boolean) {
    cart.add({ product_id: productId, quantity, options });
    if (goToCart) { setDetailFor(null); setCartOpen(true); }
  }

  async function handleRequestQuote(productId: string) {
    if (!propertyDetails.trim()) {
      setError("Please describe your property and what you need.");
      return;
    }
    if (!session) {
      setError("Please log in first to request a quote.");
      return;
    }
    if (!requireVerified()) return;
    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.rpc("submit_marketplace_quote_request", {
      p_product_id: productId,
      p_property_details: propertyDetails.trim(),
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
    <div className="min-h-screen zone-market-browse bg-[var(--zone-bg)]">
      <div className="bg-gradient-to-r from-chs-steel-blue via-chs-charcoal to-chs-amber text-white px-4 py-5 flex justify-between items-start">
        <div>
          <h1 className="font-serif text-xl font-bold">CHS Marketplace</h1>
          <p className="text-xs text-white/70">Products and services for your property</p>
        </div>
        <div className="flex gap-1.5">
          {cart.count > 0 && (
            <button onClick={() => setCartOpen(true)} className="bg-white text-chs-charcoal text-[10px] font-bold px-3 py-1.5 rounded-full">🛒 {cart.count}</button>
          )}
          {session && (<>
            <Link href="/marketplace/orders" className="bg-white/15 text-[10px] font-semibold px-3 py-1.5 rounded-full">
              📦 My deliveries
            </Link>
            <Link href="/my-quote-requests" className="bg-white/15 text-[10px] font-semibold px-3 py-1.5 rounded-full">
              My Orders &amp; Requests
            </Link>
          </>)}
          <Link href="/choose-category" className="bg-white/15 text-[10px] font-semibold px-3 py-1.5 rounded-full">
            Sell here →
          </Link>
          <Link href="/vendor" className="bg-chs-red text-[10px] font-semibold px-3 py-1.5 rounded-full">
            + List item
          </Link>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto px-4 py-3 bg-white border-b border-gray-100">
        {CATEGORY_TABS.map((tab) => (
          <Fragment key={tab.value}>
            {tab.value === VENDOR_CATEGORIES[0].value && <span className="shrink-0 self-center text-[10px] font-bold uppercase text-gray-400 pl-1">Vendors</span>}
            {tab.value === SERVICE_CATEGORIES[0].value && <span className="shrink-0 self-center text-[10px] font-bold uppercase text-gray-400 pl-3 border-l border-gray-200">Service providers</span>}
          <button
            onClick={() => setActiveCategory(tab.value)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === tab.value ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {tab.label}
          </button>
          </Fragment>
        ))}
      </nav>

      {showGate && session && !identityVerified && (
        <div ref={gateRef} className="px-4 pt-3">
          <IdentityVerificationGate
            session={session}
            onVerified={() => { setIdentityVerified(true); setShowGate(false); setError(null); }}
          />
        </div>
      )}

      <div className="px-4 pt-2 space-y-1.5">
        <DeliveryCityPicker cities={dcity.cities} cityId={dcity.cityId} onChange={dcity.setCityId} />
        {dcity.cityId && hintCount > 0 && (
          <p className="text-[10px] text-gray-600">{nearbyCount} of {hintCount} items for sale are from sellers near {dcity.city?.name}. Each item shows how far it travels, the delivery cost and when it should arrive.</p>
        )}
        {!dcity.cityId && <p className="text-[10px] text-gray-500">Choose your city to see how far each seller is and what delivery will cost.</p>}
      </div>

      <div className="px-4 pt-2">
        <div className="flex gap-1.5">
          {SCOPES.map((o) => (
            <button key={o.value} onClick={() => setScope(o.value)} className={`flex-1 py-2 rounded-full text-[11px] font-semibold ${scope === o.value ? "bg-chs-red text-white" : "bg-gray-100 text-gray-600"}`}>{o.icon} {o.short}</button>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-snug">
          {SCOPES.find((o) => o.value === scope)?.best} <button onClick={guide.show} className="underline font-semibold text-chs-charcoal">How searching works</button>
        </p>
        {scope === "near" && hasCity && hiddenFar > 0 && <p className="text-[10px] bg-chs-amber-light text-chs-amber-dark rounded-lg px-2 py-1.5 mt-1">{hiddenFar} more item{hiddenFar > 1 ? "s are" : " is"} sold from other towns. <button onClick={() => setScope("cheapest")} className="underline font-semibold">Compare with delivery included</button> or <button onClick={() => setScope("anywhere")} className="underline font-semibold">search anywhere</button>.</p>}
        {scope !== "near" && hasCity && <p className="text-[10px] text-gray-500 mt-1">{scope === "cheapest" ? "Ranked by price plus delivery to " : "Nearest sellers first, delivering to "}{dcity.city?.name}.</p>}
        {!hasCity && scope === "near" && <p className="text-[10px] text-chs-red mt-1">Choose your city above so “Near me” knows where you are. Until then everything is shown.</p>}
      </div>
      <SearchScopeGuide open={guide.open} onClose={guide.close} current={scope} onPick={setScope} />

      {sisterLink && (
        <div className="px-4 pt-2">
          <a href={sisterLink.sister_marketplace_url} target="_blank" rel="noopener noreferrer"
            className="block bg-chs-charcoal rounded-xl px-4 py-3 text-white">
            <p className="text-xs font-bold">🔗 Looking for something else? Try {sisterLink.sister_marketplace_name} →</p>
            <p className="text-[10px] text-white/70 mt-0.5">
              Our sister platform for automobiles, consumables, electronics, and more — real, verified sellers, still under CHS&apos;s own jurisdiction.
            </p>
          </a>
        </div>
      )}

      <div className="flex gap-2 px-4 pt-3">
        <button
          onClick={() => setView("items")}
          className={`flex-1 py-2 rounded-full text-xs font-semibold ${view === "items" ? "bg-chs-charcoal text-white" : "bg-gray-100 text-gray-600"}`}
        >
          Individual Items
        </button>
        <button
          onClick={() => setView("bundles")}
          className={`flex-1 py-2 rounded-full text-xs font-semibold ${view === "bundles" ? "bg-chs-charcoal text-white" : "bg-gray-100 text-gray-600"}`}
        >
          📦 Bundles ({bundles.length})
        </button>
      </div>

      {view === "bundles" ? (
        <main className="px-4 py-4 space-y-3">
          {bundles.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">No bundles available yet.</p>
          ) : (
            bundles.map((bundle) => (
              <div key={bundle.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4">
                <p className="text-sm font-bold text-chs-charcoal">{bundle.bundle_name}</p>
                <p className="text-xs text-gray-500 mt-1">{bundle.items_included}</p>
                {bundle.description && <p className="text-xs text-gray-400 mt-1 italic">{bundle.description}</p>}
                <p className="text-lg font-bold text-chs-red mt-2">{formatNaira(bundle.price)}</p>
              </div>
            ))
          )}
        </main>
      ) : (
      <main className="px-4 py-4 grid grid-cols-2 gap-3">
        {/* One page-level notice rather than one per product card —
            the same real policy applies to every "Buy now" below. */}
        <div className="col-span-2"><RefundPolicyNotice /></div>
        {filtered.length === 0 ? (
          <p className="col-span-full text-center text-sm text-gray-400 py-12">
            No listings found for this category yet.
          </p>
        ) : (
          filtered.map((product) => (
            <div key={product.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 overflow-hidden">
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
                {(product.brand || product.condition) && (
                  <p className="text-[9px] text-gray-500 mt-0.5">{[product.brand, product.condition ? product.condition.charAt(0).toUpperCase() + product.condition.slice(1) : null].filter(Boolean).join(" · ")}</p>
                )}

                {product.listing_type === "service" ? (
                  <>
                    {product.price != null && <p className="text-sm font-bold text-chs-charcoal mt-1">From {formatNaira(product.price)}</p>}
                    {submittedFor === product.id ? (
                      <p className="text-[10px] text-chs-red font-semibold mt-1.5">✓ Sent to CHS for review — you&apos;ll be notified once approved and relayed to the vendor.</p>
                    ) : quoteFormFor === product.id ? (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-[9px] text-gray-400 bg-gray-50 rounded px-2 py-1.5 leading-relaxed">
                          🛡️ This conversation is moderated and reviewed by CHS before it reaches the vendor. No phone numbers or emails, please — every real deal must stay on CHS from start to finish.
                        </p>
                        <textarea
                          value={propertyDetails}
                          onChange={(e) => setPropertyDetails(e.target.value)}
                          rows={2}
                          placeholder="Describe your property and needs — no phone numbers or emails"
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
                        Request a quote<InfoTip text="This item's real price depends on your specific job — describe what you need, and the vendor sends back a real, genuine price through CHS before any payment happens." />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-chs-charcoal mt-1">
                      {formatNaira(product.price!)}
                      {product.price_unit ? (
                        <span className="font-normal text-[10px] text-gray-500"> {product.price_unit}</span>
                      ) : null}
                    </p>
                    <div className="mt-1"><DeliveryBadge hint={hints[product.id]} /></div>
                    {hints[product.id] && hints[product.id].est_fee > 0 && (
                      <p className="text-[9px] text-chs-charcoal mt-0.5">Total with delivery: <b>{formatNaira(landed(product))}</b></p>
                    )}
                    {hints[product.id] && product.price && hints[product.id].est_fee / product.price > 0.25 && (
                      <p className="text-[9px] text-chs-red font-semibold mt-0.5">⚠️ Delivery is {Math.round((hints[product.id].est_fee / product.price) * 100)}% of the price. Check nearer sellers.</p>
                    )}
                    {product.status !== "sold_out" && (
                      <button onClick={() => { setDetailFor(product.id); setError(null); }}
                        className="mt-1.5 w-full py-1.5 rounded-full bg-chs-red text-white text-[10px] font-semibold">
                        View details &amp; add to cart
                      </button>
                    )}
                  </>
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
      )}
      {cart.count > 0 && !cartOpen && !detailFor && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 flex justify-center pointer-events-none">
          <button onClick={() => setCartOpen(true)} className="pointer-events-auto w-full max-w-md py-3 rounded-full bg-chs-charcoal text-white text-sm font-semibold shadow-lg">
            🛒 View cart · {cart.count} item{cart.count > 1 ? "s" : ""} · Check out
          </button>
        </div>
      )}
      {cartOpen && (
        <MarketplaceCart cities={dcity.cities} cityId={dcity.cityId} setCityId={dcity.setCityId} items={cart.items} loggedIn={!!session} onClose={() => setCartOpen(false)} setQty={cart.setQty} remove={cart.remove} clear={cart.clear} requireVerified={requireVerified} />
      )}
      {detailFor && (() => {
        const product = products.find((p) => p.id === detailFor);
        return product ? <ProductDetailSheet product={product} hint={hints[product.id]} onClose={() => setDetailFor(null)} onAddToCart={handleAddToCart} /> : null;
      })()}
    </div>
  );
}
