"use client";

import { useState } from "react";
import PropertyTourModal from "@/components/PropertyTourModal";

// Real, new client wrapper per direct client instruction — this
// page renders on the server, so the actual interactive tour needed
// its own small, separate component, the same real reason SaveButton
// and ShareButton are their own components on this same page too.
export default function PropertyTourButton({
  photos,
  videoUrl,
  propertyTitle,
}: {
  photos: string[];
  videoUrl?: string | null;
  propertyTitle: string;
}) {
  const [showTour, setShowTour] = useState(false);
  if (photos.length === 0 && !videoUrl) return null;

  return (
    <>
      <button onClick={() => setShowTour(true)}
        className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold backdrop-blur-sm">
        🏠 Take a Tour
      </button>
      {showTour && (
        <PropertyTourModal
          photos={photos}
          videoUrl={videoUrl}
          propertyTitle={propertyTitle}
          onClose={() => setShowTour(false)}
          onSatisfied={() => setShowTour(false)}
          onNotSatisfied={() => { setShowTour(false); window.location.href = "/"; }}
        />
      )}
    </>
  );
}
