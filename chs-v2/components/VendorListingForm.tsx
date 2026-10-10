"use client";

import { priceEvasionError } from "@/lib/listingRules";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadPropertyPhoto } from "@/lib/storage";
import FileUploadBox from "@/components/FileUploadBox";
import { Req, Opt, RequiredLegend } from "@/components/FormMarks";
import { BUILDING_MATERIALS_CATALOG, MATERIAL_SECTIONS } from "@/types/buildingMaterials";
import { categoryKind } from "@/lib/marketplaceCategories";
import { CONDITIONS, OPTION_PRESETS, SPECS, specFieldsFor } from "@/lib/marketplaceSpecs";
import type { MarketplaceVendor, ListingType } from "@/types/marketplace";

// The listing form, rebuilt the way established marketplaces describe what they sell. A product is no longer a name, a
// price and a sentence: it has an identity (brand, model, condition), the specification that decides the purchase for
// THIS kind of item (size, capacity, power, material, dimensions …), the options a buyer chooses (colour, size …), real
// stock (which also drives "sold out" by itself), a warranty, delivery information and up to six photographs. A service
// provider describes licence, experience, response time and what is included instead. Required fields carry a red *.
const field = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white";
const small = "text-[11px] font-semibold text-gray-600";
const MAX_PHOTOS = 6;

interface OptionDraft { name: string; values: string }

export default function VendorListingForm({ vendor, userId, onAdded }: { vendor: MarketplaceVendor; userId: string; onAdded: () => void }) {
  const kind = categoryKind(vendor.category);
  const types: ListingType[] = kind === "service" ? ["service"] : vendor.category === "interior_design" ? ["product", "service"] : ["product"];
  const [listingType, setListingType] = useState<ListingType>(types[0]);
  const isMaterials = vendor.category === "building_materials";
  const isProduct = listingType === "product";
  const specFields = specFieldsFor(vendor.category, listingType);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState<"new" | "used" | "refurbished" | "">("");
  const [price, setPrice] = useState<number | "">("");
  const [priceUnit, setPriceUnit] = useState("per unit");
  const [stock, setStock] = useState<number | "">("");
  const [sku, setSku] = useState("");
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [description, setDescription] = useState("");
  const [warranty, setWarranty] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [photos, setPhotos] = useState<(File | null)[]>([null]);
  const [materialSection, setMaterialSection] = useState(MATERIAL_SECTIONS[0]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [othersName, setOthersName] = useState("");
  const [othersUnit, setOthersUnit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entry = BUILDING_MATERIALS_CATALOG[materialSection]?.find((m) => m.name === selectedMaterial);
  const isOthers = entry?.unit === null;
  const brandRequired = isProduct && !!SPECS[vendor.category]?.brandRequired;

  function setPhoto(i: number, f: File | null) {
    const next = photos.slice(); next[i] = f;
    if (f && i === next.length - 1 && next.length < MAX_PHOTOS) next.push(null);
    setPhotos(next);
  }
  function addOption(nameValue: string) {
    if (options.length >= 4 || options.some((o) => o.name.toLowerCase() === nameValue.toLowerCase())) return;
    setOptions([...options, { name: nameValue, values: "" }]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalName = isProduct && isMaterials ? (isOthers ? othersName.trim() : selectedMaterial) : name.trim();
    const finalUnit = isProduct ? (isMaterials ? (isOthers ? othersUnit.trim() : entry?.unit || "") : priceUnit) : null;
    if (!finalName) { setError(isProduct && isMaterials ? "Please select a material." : isProduct ? "Please enter the product name." : "Please enter the service name."); return; }
    if (isProduct) {
      if (!condition) { setError("Please say whether it is brand new, refurbished or used."); return; }
      if (brandRequired && !brand.trim()) { setError("Please enter the brand."); return; }
      if (!price || price <= 0) { setError("Please enter a price."); return; }
      if (!finalUnit) { setError("Please enter the pricing unit."); return; }
      if (stock === "" || !Number.isInteger(stock) || stock < 1) { setError("Please enter how many you have in stock (1 or more)."); return; }
      if (photos.filter(Boolean).length < 1) { setError("Please add at least one clear photo of the product."); return; }
    }
    if (!isProduct && (!price || price <= 0)) { setError("Please enter the starting price for this service. Listings without a price cannot be submitted."); return; }
    const evasion = priceEvasionError(finalName) || priceEvasionError(description);
    if (evasion) { setError(evasion); return; }
    for (const f of specFields) {
      if (f.required && !(specs[f.key] || "").trim()) { setError(`Please fill in: ${f.label}.`); return; }
    }
    if (description.trim().length < 20) { setError("Please describe it in at least a sentence or two (20 characters or more)."); return; }

    // the options a buyer chooses (colour, size …): each needs a name and at least one value
    const optionGroups: { name: string; values: string[] }[] = [];
    for (const o of options) {
      const values = Array.from(new Set(o.values.split(",").map((v) => v.trim()).filter(Boolean))).slice(0, 12);
      if (!o.name.trim() && values.length === 0) continue;
      if (!o.name.trim() || values.length === 0) { setError(`Each option needs a name and at least one value (for example Color: Black, Silver). Please finish or remove “${o.name || "the empty option"}”.`); return; }
      optionGroups.push({ name: o.name.trim(), values });
    }
    const cleanSpecs = Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));

    setError(null); setSubmitting(true);
    const { data: created, error: insertError } = await supabase.from("marketplace_products").insert({
      vendor_id: vendor.id, name: finalName, category: vendor.category, listing_type: listingType,
      price, price_unit: isProduct ? finalUnit : "starting from",
      brand: isProduct ? brand.trim() || null : null, model: isProduct ? model.trim() || null : null,
      condition: isProduct ? condition : null, stock_quantity: isProduct ? stock : null, sku: isProduct ? sku.trim() || null : null,
      warranty: isProduct ? warranty.trim() || null : null, delivery_info: isProduct ? deliveryInfo.trim() || null : null,
      specs: cleanSpecs, option_groups: isProduct ? optionGroups : [], description: description.trim(), photos: [],
    }).select().single();
    if (insertError || !created) { setError("Could not add this listing. Please try again."); setSubmitting(false); return; }

    const urls: string[] = [];
    const files = photos.filter((f): f is File => !!f);
    for (let i = 0; i < files.length; i++) {
      const url = await uploadPropertyPhoto(files[i], userId, created.id, i);
      if (url) urls.push(url);
    }
    if (urls.length > 0) await supabase.from("marketplace_products").update({ photos: urls }).eq("id", created.id);
    setSubmitting(false);
    onAdded();
  }

  return (
    <form onSubmit={submit} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-4 mb-4 space-y-3">
      <RequiredLegend />
      {types.length > 1 && (
        <div className="flex gap-2">
          {types.map((t) => (
            <button key={t} type="button" onClick={() => { setListingType(t); setSpecs({}); }}
              className={`flex-1 py-2 rounded-lg border-2 text-xs font-semibold ${listingType === t ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>
              {t === "product" ? "Product (fixed price)" : "Service (quote-based)"}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs font-bold text-chs-charcoal">1 · What it is</p>
      {isProduct && isMaterials ? (
        <>
          <select value={materialSection} onChange={(e) => { setMaterialSection(e.target.value); setSelectedMaterial(""); }} className={field}>
            {MATERIAL_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={selectedMaterial} onChange={(e) => setSelectedMaterial(e.target.value)} className={field}>
            <option value="">Select a material…</option>
            {(BUILDING_MATERIALS_CATALOG[materialSection] || []).map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
          {isOthers && (
            <>
              <input type="text" value={othersName} onChange={(e) => setOthersName(e.target.value)} placeholder="Material name" className={field} />
              <input type="text" value={othersUnit} onChange={(e) => setOthersUnit(e.target.value)} placeholder="Pricing unit (e.g. per tonne)" className={field} />
            </>
          )}
          {selectedMaterial && !isOthers && <p className="text-[10px] text-gray-400">Standard unit for this material: <b>{entry?.unit}</b> — fixed, so every vendor&apos;s price can be compared fairly.</p>}
        </>
      ) : (
        <div>
          <label className={small}>{isProduct ? "Product name" : "Service name"}<Req /></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={field}
            placeholder={isProduct ? "e.g. Samsung 55-inch Smart LED TV" : "e.g. Estate security package"} />
        </div>
      )}
      {isProduct && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={small}>Brand{brandRequired ? <Req /> : <Opt />}</label><input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} className={field} placeholder="e.g. Samsung" /></div>
            <div><label className={small}>Model<Opt /></label><input type="text" value={model} onChange={(e) => setModel(e.target.value)} className={field} placeholder="e.g. UA55AU7000" /></div>
          </div>
          <div>
            <label className={small}>Condition<Req /></label>
            <div className="flex gap-2 mt-1">
              {CONDITIONS.map((c) => (
                <button key={c.value} type="button" onClick={() => setCondition(c.value)}
                  className={`flex-1 py-1.5 rounded-lg border-2 text-[11px] font-semibold ${condition === c.value ? "border-chs-red bg-chs-amber-light" : "border-gray-200 bg-white"}`}>{c.label}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {isProduct && (
        <>
          <p className="text-xs font-bold text-chs-charcoal pt-1">2 · Price and stock</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={small}>Price (₦)<Req /></label>
              <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : parseInt(e.target.value))} className={field} /></div>
            {!isMaterials ? (
              <div><label className={small}>Sold<Req /></label>
                <select value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} className={field}>
                  {["per unit", "per set", "per pair", "per pack", "per bag", "per sqm", "per metre", "per project"].map((u) => <option key={u}>{u}</option>)}
                </select></div>
            ) : <div />}
            <div><label className={small}>How many in stock<Req /></label>
              <input type="number" min="1" step="1" value={stock} onChange={(e) => setStock(e.target.value === "" ? "" : parseInt(e.target.value))} className={field} /></div>
            <div><label className={small}>Your SKU / code<Opt /></label><input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className={field} /></div>
          </div>
          <p className="text-[10px] text-gray-400">When the stock reaches 0 the listing is marked <b>Sold out</b> automatically, and reopens when you restock.</p>
        </>
      )}

      {!isProduct && (
        <div>
          <label className={small}>Starting price (₦)<Req /></label>
          <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : parseInt(e.target.value))} className={field} />
          <p className="text-[10px] text-gray-400 mt-1">The lowest price a customer should expect. The final quote can be higher for bigger jobs, but every listing must show a real starting price: CHS does not allow &quot;message us for the price&quot;.</p>
        </div>
      )}

      {specFields.length > 0 && (
        <>
          <p className="text-xs font-bold text-chs-charcoal pt-1">{isProduct ? "3 · Specifications" : "2 · About your service"}</p>
          <div className="grid grid-cols-2 gap-2">
            {specFields.map((f) => (
              <div key={f.key} className={f.type === "text" && (f.label.length > 22 || f.key.startsWith("What") || f.key.startsWith("Licence")) ? "col-span-2" : ""}>
                <label className={small}>{f.label}{f.required ? <Req /> : <Opt />}</label>
                {f.type === "select" ? (
                  <select value={specs[f.key] || ""} onChange={(e) => setSpecs({ ...specs, [f.key]: e.target.value })} className={field}>
                    <option value="">Select…</option>
                    {f.options?.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={f.type === "number" ? "number" : "text"} min={f.type === "number" ? "0" : undefined} value={specs[f.key] || ""} placeholder={f.placeholder}
                    onChange={(e) => setSpecs({ ...specs, [f.key]: e.target.value })} className={field} />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {isProduct && (
        <>
          <p className="text-xs font-bold text-chs-charcoal pt-1">4 · Options the buyer chooses<Opt /></p>
          <p className="text-[10px] text-gray-500">If it comes in different colours, sizes or capacities, add them here and the buyer picks one when ordering. Price and stock are shared by all choices; if a size costs more, list it as its own product.</p>
          <div className="flex flex-wrap gap-1.5">
            {OPTION_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => addOption(p)} disabled={options.length >= 4 || options.some((o) => o.name.toLowerCase() === p.toLowerCase())}
                className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-[10px] font-semibold text-chs-charcoal disabled:opacity-40">+ {p}</button>
            ))}
            <button type="button" onClick={() => addOption("")} disabled={options.length >= 4} className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-[10px] font-semibold text-chs-charcoal disabled:opacity-40">+ Other option</button>
          </div>
          {options.map((o, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              <input type="text" value={o.name} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Option, e.g. Color" className={`${field} w-28 shrink-0`} />
              <input type="text" value={o.values} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} placeholder="Values, separated by commas: Black, Silver" className={field} />
              <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="px-2 py-2 text-xs text-gray-400" aria-label="Remove option">✕</button>
            </div>
          ))}
        </>
      )}

      <p className="text-xs font-bold text-chs-charcoal pt-1">{isProduct ? "5 · Description, warranty and delivery" : "3 · Description"}</p>
      <div>
        <label className={small}>Description<Req /></label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={field}
          placeholder={isProduct ? "What it is, what makes it good, anything a buyer should know. No phone numbers or emails." : "What you do, who it suits, how you work. No phone numbers or emails."} />
      </div>
      {isProduct && (
        <>
          <div><label className={small}>Warranty<Opt /></label><input type="text" value={warranty} onChange={(e) => setWarranty(e.target.value)} className={field} placeholder="e.g. 12 months manufacturer warranty" /></div>
          <div><label className={small}>Delivery information<Opt /></label><input type="text" value={deliveryInfo} onChange={(e) => setDeliveryInfo(e.target.value)} className={field} placeholder="e.g. Delivered within Kaduna in 2–3 days; other states 5–7 days" /></div>
        </>
      )}

      <p className="text-xs font-bold text-chs-charcoal pt-1">{isProduct ? "6 · Photos" : "4 · Photos"} {isProduct ? <Req /> : <Opt />}</p>
      <p className="text-[10px] text-gray-500">{isProduct ? `Up to ${MAX_PHOTOS} clear photos — the first is the main picture buyers see. Show the front, the back, any ports or labels, and the item as it will arrive.` : `Up to ${MAX_PHOTOS} photos of your team, equipment or past work.`}</p>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((f, i) => (
          <FileUploadBox key={i} onFileSelect={(file) => setPhoto(i, file)} accept="image/*" label={i === 0 ? "main photo" : `photo ${i + 1}`} selectedFileName={f?.name} />
        ))}
      </div>

      {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
        {submitting ? "Adding…" : "Add listing"}
      </button>
    </form>
  );
}
