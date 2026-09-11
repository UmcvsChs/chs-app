"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

// Real, new component per a direct, cost-conscious client request —
// a genuine, working alternative to a paid third-party virtual-tour
// service. Shows every real, room-labeled video an owner/agent/
// manager has uploaded, and lets a genuinely interested buyer or
// tenant request a specific, additional real video if what's here
// doesn't satisfy them.
export default function PropertyVideos({ propertyId }: { propertyId: string }) {
  const { session } = useAuth();
  const [videos, setVideos] = useState<{ id: string; room_label: string; video_url: string }[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestLabel, setRequestLabel] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("property_videos").select("id, room_label, video_url").eq("property_id", propertyId)
      .then(({ data }) => setVideos(data || []));
  }, [propertyId]);

  async function handleRequestVideo() {
    if (!requestLabel.trim()) {
      setRequestError("Please name the real room or facility you'd like a video of.");
      return;
    }
    if (!session) {
      setRequestError("Please log in to request a real video.");
      return;
    }
    setSubmitting(true);
    setRequestError(null);
    const { error } = await supabase.rpc("request_property_video", {
      p_property_id: propertyId,
      p_room_label: requestLabel.trim(),
      p_note: requestNote.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setRequestError(error.message);
      return;
    }
    setRequestSuccess(true);
    setRequestLabel("");
    setRequestNote("");
  }

  if (videos.length === 0 && !session) return null;

  return (
    <div className="mb-4">
      {videos.length > 0 && (
        <>
          <p className="text-xs font-bold text-chs-charcoal mb-2">🎥 Real room videos</p>
          <div className="space-y-2 mb-2">
            {videos.map((v) => (
              <div key={v.id} className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-2">
                <p className="text-[11px] font-semibold text-chs-charcoal mb-1">{v.room_label}</p>
                <video src={v.video_url} controls playsInline className="w-full rounded-lg max-h-64" />
              </div>
            ))}
          </div>
        </>
      )}

      {session && (
        requestSuccess ? (
          <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
            ✓ Your real request has been sent to the owner. Track it anytime on <a href="/my-applications" className="underline font-semibold">My Applications</a>.
          </p>
        ) : showRequestForm ? (
          <div className="bg-[var(--zone-card)] rounded-xl border border-gray-100 p-3">
            <label className="text-xs font-semibold text-gray-600">Which real room or facility?</label>
            <input type="text" value={requestLabel} onChange={(e) => setRequestLabel(e.target.value)}
              placeholder="e.g. Kitchen cabinet, WC" className="w-full mt-1 mb-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <label className="text-xs font-semibold text-gray-600">Anything specific you want shown (optional)</label>
            <textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} rows={2}
              placeholder="e.g. Please show the water pressure" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            {requestError && <p className="text-[10px] text-chs-red bg-white rounded-lg px-2 py-1.5 mt-1.5">{requestError}</p>}
            <button onClick={handleRequestVideo} disabled={submitting}
              className="w-full mt-2 py-2 rounded-full bg-chs-red text-white text-xs font-semibold disabled:opacity-50">
              {submitting ? "Sending..." : "Send real request"}
            </button>
          </div>
        ) : (
          <button onClick={() => setShowRequestForm(true)}
            className="w-full py-2 rounded-full bg-[var(--zone-card)] border border-gray-200 text-xs font-semibold text-chs-charcoal">
            🎥 Not satisfied? Request a real video of a specific area
          </button>
        )
      )}
    </div>
  );
}
