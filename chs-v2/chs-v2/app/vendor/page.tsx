"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { uploadPropertyPhoto } from "@/lib/storage";
import { MarketplaceVendor, MarketplaceProduct, MarketplaceCategory } from "@/types/marketplace";
import { formatNaira } from "@/lib/format";

export default function VendorDashboard() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [vendor, setVendor] = useState<MarketplaceVendor | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [priceUnit, setPriceUnit] = useState("per unit");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  async function loadData() {
    if (!session) return;
    setLoading(true);

    const { data: vendorData } = await supabase
      .from("marketplace_vendors")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    setVendor(vendorData);

    if (vendorData) {
      const { data: productsData } = await supabase
        .from("marketplace_products")
        .select("*")
        .eq("vendor_id", vendorData.id)
        .order("created_at", { ascending: false });
      setProducts(productsData || []);
    }
    setLoading(false);
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price || !vendor) {
      setError("Please enter a product name and price.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { data: newProduct, error: insertError } = await supabase
      .from("marketplace_products")
      .insert({
        vendor_id: vendor.id,
        name: name.trim(),
        category: vendor.category,
        price,
        price_unit: priceUnit,
        description: description.trim() || null,
        photos: [],
      })
      .select()
      .single();

    if (insertError || !newProduct) {
      setError("Could not add this product. Please try again.");
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

  async function toggleSoldOut(productId: string, currentStatus: string) {
    const newStatus = currentStatus === "sold_out" ? "active" : "sold_out";
    await supabase.from("marketplace_products").update({ status: newStatus }).eq("id", productId);
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
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-chs-charcoal text-white px-4 py-4">
        <Link href="/" className="text-xs text-white/70">← Back to homepage</Link>
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
            CHS is reviewing your vendor registration — your products won&apos;t be publicly visible until you&apos;re verified, but you can add them now.
          </div>
        )}

        <button onClick={() => setShowForm(!showForm)}
          className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold mb-4">
          {showForm ? "Cancel" : "+ Add a product"}
        </button>

        {showForm && (
          <form onSubmit={handleAddProduct} className="bg-white rounded-xl border border-gray-100 p-4 mb-4 space-y-2">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <div className="flex gap-2">
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : parseInt(e.target.value))}
                placeholder="Price (₦)" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <select value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)}
                className="px-2 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                {["per unit", "per bag", "per sqm", "per project"].map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Description" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="w-full text-xs" />
            {error && <p className="text-xs text-chs-red">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full py-2 rounded-full bg-chs-charcoal text-white text-xs font-semibold disabled:opacity-50">
              {submitting ? "Adding..." : "Add product"}
            </button>
          </form>
        )}

        <p className="text-xs font-bold text-chs-charcoal mb-2">My products ({products.length})</p>
        {products.length === 0 ? (
          <p className="text-sm text-gray-400">No products added yet.</p>
        ) : (
          products.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 mb-2 flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-chs-charcoal">{p.name}</p>
                <p className="text-xs text-gray-500">{formatNaira(p.price)} {p.price_unit}</p>
              </div>
              <button onClick={() => toggleSoldOut(p.id, p.status)}
                className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                  p.status === "sold_out" ? "bg-gray-100 text-gray-500" : "bg-chs-amber-light text-chs-amber-dark"
                }`}>
                {p.status === "sold_out" ? "Mark active" : "Mark sold out"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
