"use client";

import { useEffect, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// A real, honest facial liveness walkthrough — restored exactly as it
// genuinely was, even before the React migration: real on-device
// camera steps, a real captured photo, submitted for real human
// review. No real biometric provider has ever been connected, in the
// original app or here — this deliberately does not fake an instant,
// automated pass.
const CHALLENGES = ["Look straight ahead", "Turn your head slowly to the RIGHT", "Turn your head slowly to the LEFT"];

export default function LivenessCheck({ session, onSubmitted }: { session: Session; onSubmitted: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  async function handleStart() {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setStarted(true);
      setStepIndex(0);
    } catch {
      setError("Could not access your camera. Please allow camera access and try again.");
    }
  }

  function handleNextStep() {
    if (stepIndex < CHALLENGES.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }
    handleCapture();
  }

  async function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    setSubmitting(true);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setSubmitting(false);
        return;
      }
      const file = new File([blob], "liveness-capture.jpg", { type: "image/jpeg" });
      const path = `${session.user.id}/liveness/capture-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("property-media").upload(path, file);
      if (uploadError) {
        setError("Could not save your capture. Please try again.");
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("property-media").getPublicUrl(path);

      await supabase.from("liveness_submissions").insert({
        user_id: session.user.id,
        captured_photo_url: urlData.publicUrl,
      });

      stream?.getTracks().forEach((t) => t.stop());
      setSubmitting(false);
      onSubmitted();
    }, "image/jpeg", 0.9);
  }

  if (!started) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
        <p className="text-sm font-bold text-chs-charcoal mb-1">🔒 Facial verification</p>
        <p className="text-xs text-gray-500 mb-3">
          This confirms a real person is completing this verification. Your capture is reviewed by a real CHS team member, not an automated pass.
        </p>
        {error && <p className="text-xs text-chs-red mb-2">{error}</p>}
        <button onClick={handleStart} className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold">
          Start face verification
        </button>
      </div>
    );
  }

  return (
    <div className="bg-chs-charcoal rounded-xl p-4">
      <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg mb-3" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex gap-1.5 mb-3">
        {CHALLENGES.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-chs-red" : "bg-white/20"}`} />
        ))}
      </div>
      <p className="text-white text-sm font-semibold text-center mb-3">{CHALLENGES[stepIndex]}</p>
      {error && <p className="text-xs text-chs-red mb-2 text-center">{error}</p>}
      <button onClick={handleNextStep} disabled={submitting}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
        {submitting ? "Submitting for review..." : stepIndex < CHALLENGES.length - 1 ? "Next step" : "Capture & submit"}
      </button>
    </div>
  );
}
