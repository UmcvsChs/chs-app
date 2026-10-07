"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/format";
import RefundPolicyNotice from "@/components/RefundPolicyNotice";
import { Req } from "@/components/FormMarks";
import { CONDITIONS } from "@/lib/marketplaceSpecs";
import type { MarketplaceProduct } from "@/types/marketplace";

// Everything a buyer needs to decide, in one place: photographs, the vendor's specification, the options to choose
// (colour, size …), how many are in stock, the warranty and delivery information — and the order itself: quantity,
// chosen options and delivery address, paid from the wallet and held in escrow until delivery is confirmed.
export default function ProductDetailSheet({ product, onClose, onBuy, bought }: {
  product: MarketplaceProduct;
  onClose: () => void;
  onBuy: (productId: string, quantity: number, options: Record<string, string>, address: string) => Promise<string | null>;
  bought: boolean;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stock = product.stock_quantity ?? null;
  const maxQty = stock === null ? 99 : Math.max(1, stock);
  const groups = product.option_groups || [];
  const specs = Object.entries(product.specs || {});
  const subtotal = (product.price || 0) * qty;
  const photos = product.photos || [];
  const condition = CONDITIONS.find((c) => c.value === product.condition)?.label;

  async function buy() {
    for (const g of groups) if (!picked[g.name]) { setError(`Please choose a ${g.name}.`); return; }
    if (address.trim().length < 10) { setError("Please give your full delivery address (house number, street, area, town)."); return; }
    setBusy(true); setError(null);
    const message = await onBuy(product.id, qty, picked, address.trim());
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-2">
          <h2 className="font-serif text-base font-bold text-chs-charcoal leading-tight">{product.name}</h2>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none" aria-label="Close">✕</button>
        </div>

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

        {bought ? (
          <p className="mt-4 text-sm text-green-700 font-semibold text-center">✓ Paid — held in escrow until delivery is confirmed.</p>
        ) : (
          <div className="mt-4 border-t border-gray-100 pt-3 space-y-2">
            {groups.map((g) => (
              <div key={g.name}>
                <label className="text-[11px] font-semibold text-gray-600">{g.name}<Req /></label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {g.values.map((v) => (
                    <button key={v} type="button" onClick={() => setPicked({ ...picked, [g.name]: v })}
                      className={`px-3 py-1.5 rounded-full border-2 text-[11px] font-semibold ${picked[g.name] === v ? "border-chs-red bg-chs-amber-light" : "border-gray-200"}`}>{v}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-semibold text-gray-600">Quantity</label>
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="w-7 h-7 rounded-full border border-gray-200 text-sm">−</button>
              <span className="text-sm font-bold w-6 text-center">{qty}</span>
              <button type="button" onClick={() => setQty(Math.min(maxQty, qty + 1))} className="w-7 h-7 rounded-full border border-gray-200 text-sm">+</button>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-600">Delivery address<Req /></label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="House number, street, area, town and state. No phone numbers — CHS handles all contact."
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-xs" />
            </div>
            <p className="text-xs text-chs-charcoal">Total: <b>{formatNaira(subtotal)}</b> <span className="text-gray-500">+ CHS commission (6%) = {formatNaira(Math.round(subtotal * 1.06))}</span></p>
            <RefundPolicyNotice />
            {error && <p className="text-xs text-chs-red">{error}</p>}
            <button onClick={buy} disabled={busy} className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {busy ? "Processing…" : "🛒 Pay from my wallet"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
