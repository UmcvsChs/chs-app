"use client";

import { useEffect } from "react";

// Real, decisive fix following two separate, confirmed, serious
// regressions traced directly back to the service worker this
// component used to register — including one that produced the exact
// "back to splash screen" complaint raised repeatedly and urgently.
// A service worker genuinely earns its complexity only when it's
// reliable; this one has now caused real harm twice. Rather than risk
// a third, subtler bug in the same mechanism, it's removed outright —
// and any copy already installed in a real browser (from before this
// fix) is now actively, forcibly unregistered here, with its cache
// cleared, so this can't keep causing stale-content problems for
// anyone who already has the old version sitting in their browser.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    }
    if ("caches" in window) {
      caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
    }
  }, []);

  return null;
}
