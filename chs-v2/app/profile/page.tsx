"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// A real profile picture / avatar — genuinely useful as a means of
// identification, especially for agents and other professionals where
// a name alone can be ambiguous. Any registered person can upload one.
export default function ProfilePage() {
  const router = useRouter();
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose a real image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Please choose an image under 5MB.");
      return;
    }

    setError(null);
    setUploading(true);
    setPreview(URL.createObjectURL(file));

    const ext = file.name.split(".").pop();
    const path = `${session.user.id}/avatar/photo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("property-media").upload(path, file, { upsert: true });
    if (uploadError) {
      setError("Could not upload this image. Please try again.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("property-media").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", session.user.id);

    if (updateError) {
      setError("Could not save your new picture. Please try again.");
      setUploading(false);
      return;
    }

    await refreshProfile();
    setUploading(false);
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }

  const currentAvatar = preview || profile?.avatar_url;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-xs text-gray-400 mb-4 inline-block">← Back to homepage</Link>
        <h1 className="font-serif text-2xl font-bold text-chs-charcoal mb-1">My Profile</h1>
        <p className="text-sm text-gray-500 mb-6">
          Add a photo or logo — real identification helps clients and customers recognise you.
        </p>

        <div className="bg-white rounded-xl border border-gray-100 p-6 flex flex-col items-center">
          <div className="w-28 h-28 rounded-full bg-chs-amber-light overflow-hidden flex items-center justify-center mb-4">
            {currentAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentAvatar} alt="Your profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-chs-amber-dark">
                {profile?.full_name?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-chs-charcoal mb-1">{profile?.full_name}</p>
          <p className="text-xs text-gray-400 mb-4 capitalize">{profile?.role}</p>

          <label className="w-full">
            <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="hidden" />
            <span className="block w-full text-center py-3 rounded-full bg-chs-red text-white text-sm font-semibold cursor-pointer">
              {uploading ? "Uploading..." : currentAvatar ? "Change photo/logo" : "Upload photo/logo"}
            </span>
          </label>

          {error && <p className="text-xs text-chs-red bg-chs-amber-light rounded-lg px-3 py-2 mt-3 w-full text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}
