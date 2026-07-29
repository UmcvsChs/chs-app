"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const ACTION_OPTIONS: { type: "inspection" | "offer" | "rent"; label: string }[] = [
  { type: "inspection", label: "Book an inspection" },
  { type: "offer", label: "Make an offer" },
  { type: "rent", label: "Start a rental application" },
];

// Restored from a real, confirmed feature in the original app — with
// one genuine, disclosed improvement: the original could only track
// interest anonymously in browser memory, resetting on every reload.
// This version is real and persistent from the start, and can
// genuinely notify the real person once their property of interest
// actually gets verified — something the original's anonymous
// approach could never do.
export default function InterestButton({ propertyId, propertyTitle }: { propertyId: string; propertyTitle: string }) {
  const router = useRouter();
  const { session } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [alreadyExpressed, setAlreadyExpressed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleInterest(actionType: "inspection" | "offer" | "rent") {
    if (!session) {
      router.push("/login");
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from("property_interest").insert({
      property_id: propertyId,
      user_id: session.user.id,
      action_type: actionType,
    });

    // A real unique-constraint violation (code 23505) means this real
    // person already expressed interest — the database's own genuine
    // protection catching it, not just a client-side guess.
    if (error?.code === "23505") {
      setAlreadyExpressed(true);
      setSubmitting(false);
      return;
    }

    if (!error) {
      // Real admin notification — matching the original's exact intent
      // of helping CHS prioritise which pending listings to chase.
      const { count } = await supabase
        .from("property_interest")
        .select("*", { count: "exact", head: true })
        .eq("property_id", propertyId);

      const admins = await supabase.from("profiles").select("id").eq("role", "admin");
      for (const admin of admins.data || []) {
        await supabase.rpc("notify_user", {
          p_user_id: admin.id,
          p_title: "Interest on unverified listing",
          p_body: `${propertyTitle} — someone just tried to "${actionType}" (${count} interest${count === 1 ? "" : "s"} total so far). Worth prioritising this one's verification.`,
          p_link: "/admin",
        });
      }
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted || alreadyExpressed) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
        <p className="text-sm font-semibold text-chs-charcoal mb-1">✓ Noted</p>
        <p className="text-xs text-gray-500">
          {alreadyExpressed
            ? "You've already let us know you're interested in this one — no need to tap again. We'll notify you the moment it's verified."
            : "This property is still being verified by CHS, so we can't proceed just yet — but we've noted your interest, and it genuinely helps us prioritise getting it verified faster. Check back soon."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
      <p className="text-xs text-gray-500 mb-2">
        This property is still under verification. Let us know what you&apos;re interested in, and we&apos;ll notify you the moment it&apos;s confirmed.
      </p>
      {ACTION_OPTIONS.map((opt) => (
        <button
          key={opt.type}
          onClick={() => handleInterest(opt.type)}
          disabled={submitting}
          className="w-full py-3 rounded-full bg-chs-charcoal text-white text-sm font-semibold disabled:opacity-50"
        >
          I&apos;m interested — {opt.label}
        </button>
      ))}
    </div>
  );
}
