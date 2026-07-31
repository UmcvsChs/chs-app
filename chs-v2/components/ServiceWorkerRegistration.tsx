"use client";

import { useEffect } from "react";

// Registers the real service worker — the actual piece that makes this
// a genuinely complete, installable PWA, alongside the manifest.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed:", err);
      });
    }
  }, []);

  return null;
}
