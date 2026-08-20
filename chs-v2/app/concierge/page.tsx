"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// Real "Talk to an Agent" — anyone can type or speak a free-form
// request, logged in or not. It lands directly in concierge_requests
// (see backend-v2/47_concierge_requests.sql) for the CHS team to work.
// Voice uses the browser's own built-in speech recognition — no new
// service, no extra cost, works today in Chrome/Edge/Safari.

type SpeechRecognitionResultLike = { transcript: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

export default function ConciergePage() {
  const { session, profile } = useAuth();
  const [message, setMessage] = useState("");
  const [contactName, setContactName] = useState(profile?.full_name || "");
  const [contactPhone, setContactPhone] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [inputMethod, setInputMethod] = useState<"text" | "voice">("text");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const voiceSupported = typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-NG";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: { results: SpeechRecognitionResultLike[][] }) => {
      const transcript = event.results[0][0].transcript;
      setMessage((prev) => (prev ? prev + " " + transcript : transcript));
      setInputMethod("voice");
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  async function handleSubmit() {
    if (!message.trim()) {
      setError("Please tell us what you're looking for — a few sentences is enough.");
      return;
    }
    if (!session && !contactPhone.trim()) {
      setError("Please leave a phone number so our team can reach you back.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("submit_concierge_request", {
      p_raw_message: message.trim(),
      p_input_method: inputMethod,
      p_contact_name: contactName.trim() || null,
      p_contact_phone: contactPhone.trim() || null,
    });

    setSubmitting(false);
    if (rpcError) {
      setError("Something went wrong sending your request — please try again.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-lg font-semibold text-chs-charcoal mb-2">Thank you — we&apos;ve got it.</p>
        <p className="text-sm text-gray-500 max-w-sm mb-6">
          A real member of the CHS team will review your request and reach out directly.
          {session ? " You can also check My Saved Searches once we've matched your criteria." : ""}
        </p>
        <Link href="/" className="text-sm font-semibold text-chs-red">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-chs-charcoal mb-1">Talk to a CHS Agent</h1>
        <p className="text-sm text-gray-500 mb-6">
          Tell us what you&apos;re looking for in your own words — type it, or use your voice.
          A real person on our team will search and follow up with you directly.
        </p>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Your request</label>
            <textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); setInputMethod("text"); }}
              rows={5}
              placeholder="e.g. Hi admin, I want a 2-bedroom flat in Benawa GRA, budget around ₦2m/year. I'd prefer a gated estate with steady power."
              className="w-full mt-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={isRecording ? stopVoice : startVoice}
                className={`mt-2 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  isRecording ? "bg-red-50 border-red-300 text-red-600" : "border-gray-300 text-gray-600"
                }`}
              >
                {isRecording ? "● Recording — tap to stop" : "🎙 Speak instead"}
              </button>
            )}
          </div>

          {!session && (
            <>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  Not logged in — leave your contact details so we can reach you back
                </p>
                <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your name" className="w-full mb-2 px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Phone number" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-chs-red text-white font-semibold py-3 rounded-lg text-sm disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send to CHS Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
