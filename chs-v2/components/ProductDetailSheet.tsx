"use client";

import QtyInput from "@/components/QtyInput";

import { useState } from "react";
import { formatNaira } from "@/lib/format";
import { Req } from "@/components/FormMarks";
import { CONDITIONS } from "@/lib/marketplaceSpecs";
import type { MarketplaceProduct } from "@/types/marketplace";
import DeliveryBadge from "@/components/DeliveryBadge";
import type { DeliveryHint } from "@/lib/delivery";

// Everything a buyer needs to decide, in one place: photographs, the vendor's specification, the options to choose
// (colour, size …), how many are in stock, the warranty and delivery information — and the order itself: quantity,
// chosen options and delivery address, paid from the wallet and held in escrow until delivery is confirmed.
export default function ProductDetailSheet({ product, hint, onClose, onAddToCart }: {
  product: MarketplaceProduct;
  hint?: DeliveryHint;
  onClose: () => void;
  onAddToCart: (productId: string, quantity: number, options: Record<string, string>, goToCart: boolean) => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stock = product.stock_quantity ?? null;
  const maxQty = stock === null ? 1000 : Math.max(1, Math.min(stock, 1000));
  const groups = product.option_groups || [];
  const specs = Object.entries(product.specs || {});
  const subtotal = (product.price || 0) * qty;
  const photos = product.photos || [];
  const condition = CONDITIONS.find((c) => c.value === product.condition)?.label;

  function add(goToCart: boolean) {
    for (const g of groups) if (!picked[g.name]) { setError(`Please choose a ${g.name}.`); return; }
    setError(null);
    onAddToCart(product.id, qty, picked, goToCart);
    if (!goToCart) setAdded(true);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-2">
          <h2 className="font-serif text-base font-bold text-chs-charcoal leading-tight">{product.name}</h2>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none" aria-label="Close">✕</button>
        </div>
        {hint ? <div className="mt-2"><DeliveryBadge hint={hint} big /></div> : <p className="mt-2 text-[10px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">Choose your city on the marketplace page to see how far this seller is and what delivery will cost.</p>}

        {photos.length > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[photoIndex]} alt={product.name} className="w-full h-52 object-cover rounded-xl mt-2" />
            {photos.length > 1 && (
              <div className="flex gap-1.5 mt-1.5 overflow-x-auto">
                {photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p} src={p} alt="" onClick={() => setPhotoIndex(i)} className={`h-12 w-12 object-cover rounded-md shrink-0 cursor-pointer ${i === photoIndex ? "ring-2 ring-chs-red" : "opacity-70"}`} />
                ))}
              </div>
            )}
          </>
        ) : <div className="h-28 bg-gray-100 rounded-xl mt-2 flex items-center justify-center text-xs text-gray-400">No photo</div>}

        <div className="flex flex-wrap gap-1.5 mt-2">
          {product.brand && <span className="text-[10px] font-semibold bg-gray-100 text-chs-charcoal px-2 py-0.5 rounded-full">{product.brand}{product.model ? ` · ${product.model}` : ""}</span>}
          {condition && <span className="text-[10px] font-semibold bg-chs-amber-light text-chs-amber-dark px-2 py-0.5 rounded-full">{condition}</span>}
          {stock !== null && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stock <= 5 ? "bg-red-50 text-chs-red" : "bg-green-50 text-green-700"}`}>{stock <= 5 ? `Only ${stock} left` : "In stock"}</span>}
        </div>

        <p className="text-lg font-bold text-chs-charcoal mt-2">{formatNaira(product.price || 0)} <span className="text-xs font-normal text-gray-500">{product.price_unit}</span></p>
        {product.description && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{product.description}</p>}

        {specs.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-bold text-chs-charcoal mb-1">Specifications</p>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              {specs.map(([k, v], i) => (
                <div key={k} className={`flex text-[11px] ${i % 2 ? "bg-white" : "bg-gray-50"}`}>
                  <span className="w-2/5 px-2 py-1.5 text-gray-500">{k}</span><span className="flex-1 px-2 py-1.5 text-chs-charcoal">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {(product.warranty || product.delivery_info) && (
          <div className="mt-2 text-[11px] text-gray-600 space-y-0.5">
            {product.warranty && <p>🛡️ <b>Warranty:</b> {product.warranty}</p>}
            {product.delivery_info && <p>🚚 <b>Delivery:</b> {product.delivery_info}</p>}
          </div>
        )}

        <div className="mt-4 border-t border-gray-100 pt-3 space-y-2">
          {groups.map((g) => (
            <div key={g.name}>
              <label className="text-[11px] font-semibold text-gray-600">{g.name}<Req /></label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {g.values.map((v) => (
                  <button key={v} type="button" onClick={() => { setPicked({ ...picked, [g.name]: v }); setAdded(false); }}
                    className={`px-3 py-1.5 rounded-full border-2 text-[11px] font-semibold ${picked[g.name] === v ? "border-chs-red bg-chs-amber-light" : "border-gray-200"}`}>{v}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-semibold text-gray-600">Quantity</label>
            <button type="button" onClick={() => { setQty(Math.max(1, qty - 1)); setAdded(false); }} className="w-7 h-7 rounded-full border border-gray-200 text-sm">−</button>
            <QtyInput value={qty} max={maxQty} onChange={(n) => { setQty(n); setAdded(false); }} />
            <button type="button" onClick={() => { setQty(Math.min(maxQty, qty + 1)); setAdded(false); }} className="w-7 h-7 rounded-full border border-gray-200 text-sm">+</button>
          </div>
          <p className="text-xs text-chs-charcoal">Subtotal: <b>{formatNaira(subtotal)}</b> <span className="text-gray-500">(CHS fee is added at checkout)</span></p>
          {error && <p className="text-xs text-chs-red">{error}</p>}
          {added && <p className="text-xs text-green-700 font-semibold">✓ Added to your cart. Keep shopping, or open the cart from the bar at the bottom.</p>}
          <div className="flex gap-2">
            <button onClick={() => add(false)} className="flex-1 py-2.5 rounded-full border-2 border-chs-red text-chs-red text-sm font-semibold">Add to cart</button>
            <button onClick={() => add(true)} className="flex-1 py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold">Buy now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
