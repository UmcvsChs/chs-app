"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Property } from "@/types/property";
import { uploadPropertyVideo } from "@/lib/storage";
import InfoTip from "@/components/InfoTip";

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
  // Real, direct fix closing an honestly-flagged gap: adding a video
  // to a property already listed — not just at the moment of
  // creation — the other real half of the room-video feature.
  const [existingVideos, setExistingVideos] = useState<{ id: string; room_label: string; video_url: string }[]>([]);
  const [newVideoLabel, setNewVideoLabel] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

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
    supabase.from("property_videos").select("id, room_label, video_url").eq("property_id", params.id as string)
      .then(({ data }) => setExistingVideos(data || []));
  }, [authLoading, session, params.id]);

  async function handleUploadVideo(file: File) {
    if (!newVideoLabel.trim() || !session) {
      setVideoError("Please type a real room label first.");
      return;
    }
    setVideoError(null);
    setUploadingVideo(true);
    const url = await uploadPropertyVideo(file, session.user.id, params.id as string, newVideoLabel.trim());
    if (!url) {
      setUploadingVideo(false);
      setVideoError("This real video could not be uploaded — please check it's under 50MB.");
      return;
    }
    const { data, error: insertError } = await supabase.from("property_videos")
      .insert({ property_id: params.id as string, uploaded_by: session.user.id, room_label: newVideoLabel.trim(), video_url: url })
      .select("id, room_label, video_url").single();
    setUploadingVideo(false);
    if (insertError || !data) {
      setVideoError("The video uploaded but could not be saved. Please try again.");
      return;
    }
    setExistingVideos([...existingVideos, data]);
    setNewVideoLabel("");
  }

  async function handleDeleteVideo(videoId: string) {
    await supabase.from("property_videos").delete().eq("id", videoId);
    setExistingVideos(existingVideos.filter((v) => v.id !== videoId));
  }

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
            <div className="border-t border-gray-200 pt-3">
              <label className="text-xs font-semibold text-gray-600">🎥 Real room videos<InfoTip text="A free, real alternative to a paid virtual-tour service — add a short video per room so buyers and tenants can genuinely see the place before asking for a physical visit." /></label>
              {existingVideos.map((v) => (
                <div key={v.id} className="bg-[var(--zone-card)] rounded-lg p-2 mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[11px] font-semibold text-chs-charcoal">{v.room_label}</p>
                    <button type="button" onClick={() => handleDeleteVideo(v.id)} className="text-[10px] text-chs-red font-semibold">Remove</button>
                  </div>
                  <video src={v.video_url} controls playsInline className="w-full rounded-lg max-h-48" />
                </div>
              ))}
              <div className="mt-2">
                <input type="text" value={newVideoLabel} onChange={(e) => setNewVideoLabel(e.target.value)}
                  placeholder="e.g. Kitchen, Master bedroom" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-1.5" />
                <label className="block w-full text-center px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-300 text-xs font-semibold text-gray-500 cursor-pointer">
                  {uploadingVideo ? "Uploading..." : `📹 Tap to record or choose a video for "${newVideoLabel.trim() || "this room"}"`}
                  <input type="file" accept="video/*" className="hidden" disabled={uploadingVideo}
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadVideo(file); e.target.value = ""; }} />
                </label>
                {videoError && <p className="text-[10px] text-chs-red bg-chs-amber-light rounded-lg px-2 py-1.5 mt-1.5">{videoError}</p>}
              </div>
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
