"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Property } from "@/types/property";

// A real, complete edit capability — genuinely missing from this
// rebuild, found during a systematic comparison against the real
// original. Built as a genuine improvement on the original: that
// version only ever let an owner edit the price, using mock,
// hardcoded data — this edits the real property record directly,
// with more of what an owner would actually need to fix.
export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (authLoading || !session) return;
    supabase
      .from("properties")
      .select("*")
      .eq("id", params.id as string)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data || data.owner_id !== session.user.id) {
          setError("This listing could not be found, or you don't have permission to edit it.");
          setLoading(false);
          return;
        }
        setProperty(data as Property);
        setPrice(String(data.price ?? ""));
        setDescription(data.description || "");
        setLoading(false);
      });
  }, [authLoading, session, params.id]);

  async function handleSave() {
    const numericPrice = parseInt(price.replace(/\D/g, ""), 10);
    if (!numericPrice || numericPrice < 1000) {
      setError("Please enter a valid price.");
      return;
    }
    setError(null);
    setSaving(true);

    const { error: updateError } = await supabase
      .from("properties")
      .update({ price: numericPrice, description: description.trim() })
      .eq("id", params.id as string);

    setSaving(false);
    if (updateError) {
      setError("Could not save your changes. Please try again.");
      return;
    }
    setSaved(true);
    setTimeout(() => router.push("/owner"), 1500);
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }
  if (error && !property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <Link href="/owner" className="text-sm font-semibold text-chs-red">Back to My Properties</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen zone-owner bg-[var(--zone-bg)] px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/owner" className="text-xs text-gray-400">← Back to My Properties</Link>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mt-1 mb-1">Edit listing</h1>
        <p className="text-sm text-gray-500 mb-6">{property?.title}</p>

        {saved ? (
          <p className="text-sm font-semibold text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">
            ✓ Listing updated — now live to buyers immediately.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Price (₦)</label>
              <input type="text" value={price} onChange={(e) => setPrice(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
                className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
            </div>
            {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2">{error}</p>}
            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
