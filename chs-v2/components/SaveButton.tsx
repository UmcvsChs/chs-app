"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// Real, working "save a property" — restored after being found
// completely missing during a direct re-audit of the homepage. A real
// database record, not a decorative icon.
export default function SaveButton({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const { session } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("saved_properties")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("property_id", propertyId)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [session, propertyId]);

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!session) {
      router.push("/login");
      return;
    }
    setLoading(true);
    if (saved) {
      await supabase.from("saved_properties").delete().eq("user_id", session.user.id).eq("property_id", propertyId);
      setSaved(false);
    } else {
      await supabase.from("saved_properties").insert({ user_id: session.user.id, property_id: propertyId });
      setSaved(true);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggleSave}
      disabled={loading}
      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm z-10"
      aria-label={saved ? "Remove from saved" : "Save property"}
    >
      <span className={saved ? "text-chs-red" : "text-gray-400"}>{saved ? "♥" : "♡"}</span>
    </button>
  );
}
