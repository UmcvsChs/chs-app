"use client";

import { useState } from "react";
import { MarketplaceProduct, MarketplaceCategory } from "@/types/marketplace";
import { formatNaira } from "@/lib/format";

const CATEGORY_TABS: { value: MarketplaceCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "interior_design", label: "Interior Design" },
  { value: "furniture", label: "Furniture" },
  { value: "bedding_textiles", label: "Bedding & Textiles" },
  { value: "home_equipment", label: "Home Equipment" },
  { value: "building_materials", label: "Building Materials" },
];

export default function MarketplaceClient({ products }: { products: MarketplaceProduct[] }) {
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory | "all">("all");

  const filtered =
    activeCategory === "all" ? products : products.filter((p) => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-chs-steel-blue via-chs-charcoal to-chs-amber text-white px-4 py-5">
        <h1 className="font-serif text-xl font-bold">CHS Marketplace</h1>
        <p className="text-xs text-white/70">Furnish and equip your space</p>
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
            No products found for this category yet.
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
                <p className="text-sm font-bold text-chs-charcoal mt-1">
                  {formatNaira(product.price)}
                  {product.price_unit ? (
                    <span className="font-normal text-[10px] text-gray-500"> {product.price_unit}</span>
                  ) : null}
                </p>
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
