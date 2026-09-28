"use client";

import { useEffect, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// A real, honest facial liveness walkthrough: real on-device camera
// steps, a real captured photo, submitted for real human review. No
// biometric provider is connected — this deliberately does not fake an
// instant, automated pass.
//
// Rebuilt after a direct client report from a real phone: the steps
// ("look straight, turn right, turn left") ran smoothly, but the
// camera picture never appeared, and nothing said anything was wrong.
// The old version treated "the phone handed over a camera stream" as
// if it meant "the person can see themselves" — on phones those are
// not the same thing, and every way the second can fail was silent:
//   - React does not reliably write the `muted` attribute onto a
//     video element, and phones refuse to autoplay video without it,
//     so the picture stayed frozen/black with the stream attached.
//   - Nothing ever called play() explicitly, so a phone that wanted a
//     tap before starting video simply never started it.
//   - The step buttons worked whether or not any picture was showing.
//   - Capturing from a video that never played produced an empty
//     image, which was quietly dropped — so pressing "submit" did
//     nothing and said nothing.
//   - A failed database save was not checked, so a failure could still
//     be reported as "under review".
// The fix is not one tweak: the camera now has to prove it is showing
// a picture before any step can proceed, every failure says what went
// wrong, and a phone that needs a tap gets a visible button for it.
const CHALLENGES = ["Look straight ahead", "Turn your head slowly to the RIGHT", "Turn your head slowly to the LEFT"];

function cameraErrorMessage(e: unknown): string {
  const name = (e as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission was blocked. Tap the lock or camera icon next to the web address, allow the camera for this site, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Your camera is being used by another app or browser tab. Close it and try again.";
  }
  return "Could not start your camera. Please try again, or open this page directly in Chrome or Safari.";
}

export default function LivenessCheck({ session, onSubmitted }: { session: Session; onSubmitted: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Stop the camera only when this component is genuinely removed.
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Attach the stream once the video element genuinely exists, set
  // every attribute a phone insists on imperatively (React alone does
  // not reliably do this), and start playback explicitly.
  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;

    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.srcObject = stream;
    video.play().catch(() => setNeedsTap(true));

    // If no picture has appeared after a few seconds, say so plainly
    // instead of leaving someone staring at a black box.
    const timer = setTimeout(() => {
      if (!(video.videoWidth > 0)) {
        setError("Your camera opened but no picture is coming through. Close any other app using the camera, make sure you're in Chrome or Safari directly (not inside WhatsApp, Instagram or Facebook), then try again.");
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [stream, started]);

  async function handleStart() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't open the camera here. Please open the app directly in Chrome or Safari (not inside WhatsApp, Instagram or Facebook), and make sure the web address starts with https://.");
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = mediaStream;
      setCameraReady(false);
      setNeedsTap(false);
      setStream(mediaStream);
      setStarted(true);
      setStepIndex(0);
    } catch (e) {
      setError(cameraErrorMessage(e));
    }
  }

  function handleManualPlay() {
    videoRef.current?.play().then(() => setNeedsTap(false)).catch(() => {
      setError("The camera still won't start. Please close this page, reopen it in Chrome or Safari, and try again.");
    });
  }

  function handleNextStep() {
    if (!cameraReady) return;
    if (stepIndex < CHALLENGES.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }
    handleCapture();
  }

  async function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      setError("Your camera picture isn't showing yet, so nothing can be captured. Wait until you can see yourself on screen, then try again.");
      return;
    }
    setError(null);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    setSubmitting(true);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError("Could not take the picture. Please try again.");
        setSubmitting(false);
        return;
      }
      const file = new File([blob], "liveness-capture.jpg", { type: "image/jpeg" });
      const path = `${session.user.id}/liveness/capture-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("property-media").upload(path, file);
      if (uploadError) {
        setError(`Could not save your picture: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("property-media").getPublicUrl(path);

      const { error: insertError } = await supabase.from("liveness_submissions").insert({
        user_id: session.user.id,
        captured_photo_url: urlData.publicUrl,
      });
      if (insertError) {
        setError(`Your picture was saved but could not be sent for review: ${insertError.message}`);
        setSubmitting(false);
        return;
      }

      stopCamera();
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
      <div className="relative mb-3">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onPlaying={() => { setCameraReady(true); setNeedsTap(false); setError(null); }}
          className="w-full rounded-lg bg-black min-h-[260px] object-cover"
        />
        {!cameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            {needsTap ? (
              <button onClick={handleManualPlay} className="px-5 py-3 rounded-full bg-chs-red text-white text-sm font-semibold">
                Tap to show camera
              </button>
            ) : (
              <p className="text-white/80 text-xs">Starting your camera…</p>
            )}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex gap-1.5 mb-3">
        {CHALLENGES.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-chs-red" : "bg-white/20"}`} />
        ))}
      </div>
      <p className="text-white text-sm font-semibold text-center mb-3">{CHALLENGES[stepIndex]}</p>
      {error && <p className="text-xs text-chs-red bg-white/90 rounded-lg px-3 py-2 mb-3 text-center">{error}</p>}
      <button onClick={handleNextStep} disabled={submitting || !cameraReady}
        className="w-full py-3 rounded-full bg-chs-red text-white text-sm font-semibold disabled:opacity-50">
        {submitting ? "Submitting for review..."
          : !cameraReady ? "Waiting for camera…"
          : stepIndex < CHALLENGES.length - 1 ? "Next step" : "Capture & submit"}
      </button>
    </div>
  );
}
